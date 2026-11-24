import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    passwordResetRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    masterRecoveryCode: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
    },
  };
  return {
    mockTx: tx,
    mockPrisma: {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      user: {
        findUnique: vi.fn(),
      },
      passwordResetRequest: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      masterRecoveryCode: {
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("../prisma", () => ({
  prisma: mockPrisma,
}));

import { hashPassword } from "../password";
import {
  RESET_CODE_ALPHABET,
  MAX_RESET_FAILED_ATTEMPTS,
  RECOVERY_CODE_COUNT,
  PasswordResetError,
  generateReadableCode,
  normalizeResetCode,
  hashResetSecret,
  submitPasswordResetRequest,
  approvePasswordResetRequest,
  redeemPasswordReset,
  regenerateMasterRecoveryCodes,
} from "./passwordReset";

describe("passwordReset service", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-chars!!";
    vi.clearAllMocks();
  });

  it("generates unbiased readable codes, normalizes input, and separates HMAC domains", () => {
    const resetCode = generateReadableCode(4, 3);
    expect(resetCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const ch of resetCode.replace(/-/g, "")) {
      expect(RESET_CODE_ALPHABET.includes(ch)).toBe(true);
    }

    const recoveryCode = generateReadableCode(4, 4);
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const normalized = normalizeResetCode("  ab23 - cd45 ef67 ");
    expect(normalized).toBe("AB23CD45EF67");
    expect(hashResetSecret("reset-code", normalized)).not.toBe(
      hashResetSecret("recovery-code", normalized),
    );
  });

  it("enforces anti-enumeration and deduplicates active PENDING requests", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await submitPasswordResetRequest({ username: "missing_user", ip: "1.2.3.4" })).toEqual({
      recorded: false,
      userId: null,
      username: null,
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 2, username: "inactive", isActive: false });
    expect(await submitPasswordResetRequest({ username: "inactive", ip: "1.2.3.4" })).toEqual({
      recorded: false,
      userId: null,
      username: null,
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 5, username: "kasir1", isActive: true });
    mockTx.passwordResetRequest.findFirst.mockResolvedValueOnce({ id: 42 });
    mockTx.passwordResetRequest.update.mockResolvedValueOnce({ id: 42 });

    const res = await submitPasswordResetRequest({
      username: "  Kasir1 ",
      note: "Lupa password baru",
      ip: "100.64.0.1",
    });

    expect(res).toEqual({ recorded: true, userId: 5, username: "kasir1" });
    expect(mockTx.passwordResetRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          note: "Lupa password baru",
          requestIp: "100.64.0.1",
        }),
      }),
    );
    expect(mockTx.passwordResetRequest.create).not.toHaveBeenCalled();
  });

  it("approves pending request by expiring older codes and storing only HMAC hash", async () => {
    mockTx.passwordResetRequest.findUnique.mockResolvedValueOnce({
      id: 10,
      userId: 5,
      status: "PENDING",
      user: { id: 5, username: "kasir1", isActive: true },
    });
    mockTx.passwordResetRequest.update.mockResolvedValueOnce({
      id: 10,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const issued = await approvePasswordResetRequest(10, "master");
    expect(issued.username).toBe("kasir1");
    expect(issued.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(mockTx.passwordResetRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5, status: "APPROVED", id: { not: 10 } },
        data: { status: "EXPIRED", tokenHash: null },
      }),
    );
    const updateArg = mockTx.passwordResetRequest.update.mock.calls[0][0];
    expect(updateArg.data.tokenHash).toBe(
      hashResetSecret("reset-code", normalizeResetCode(issued.code)),
    );
    expect(updateArg.data.tokenHash).not.toContain(issued.code);
  });

  it("enforces password policy before redeeming codes", async () => {
    await expect(
      redeemPasswordReset({ username: "kasir1", code: "AAAA-BBBB-CCCC", newPassword: "short" }),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("redeems valid reset code once, updates hash, revokes sessions, and rejects replay", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      username: "kasir1",
      role: "admin",
      isActive: true,
    });
    mockTx.passwordResetRequest.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.user.update.mockResolvedValueOnce({});
    mockTx.session.updateMany.mockResolvedValueOnce({ count: 2 });

    const okRes = await redeemPasswordReset({
      username: "kasir1",
      code: "abcd-efgh-2345",
      newPassword: "PasswordBaru123",
    });
    expect(okRes).toEqual({
      userId: 5,
      username: "kasir1",
      role: "admin",
      method: "reset_code",
    });
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5, revokedAt: null },
      }),
    );

    // Replay attempt returns count: 0 -> throws PasswordResetError
    mockTx.passwordResetRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    mockTx.passwordResetRequest.findFirst.mockResolvedValueOnce(null);
    await expect(
      redeemPasswordReset({
        username: "kasir1",
        code: "abcd-efgh-2345",
        newPassword: "PasswordBaru123",
      }),
    ).rejects.toBeInstanceOf(PasswordResetError);
  });

  it("increments failedAttempts and expires reset code after 5 invalid attempts", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 5,
      username: "kasir1",
      role: "admin",
      isActive: true,
    });
    mockTx.passwordResetRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    mockTx.passwordResetRequest.findFirst.mockResolvedValueOnce({
      id: 77,
      failedAttempts: MAX_RESET_FAILED_ATTEMPTS - 1,
    });
    mockTx.passwordResetRequest.update.mockResolvedValueOnce({});

    await expect(
      redeemPasswordReset({
        username: "kasir1",
        code: "ZZZZ-ZZZZ-ZZZZ",
        newPassword: "PasswordBaru123",
      }),
    ).rejects.toThrow(PasswordResetError);

    expect(mockTx.passwordResetRequest.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        failedAttempts: MAX_RESET_FAILED_ATTEMPTS,
        status: "EXPIRED",
        tokenHash: null,
      },
    });
  });

  it("regenerates 8 recovery codes only for active master with valid password and redeems for master only", async () => {
    const validMasterHash = await hashPassword("MasterLama123");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: "master",
      isActive: true,
      passwordHash: validMasterHash,
    });

    await expect(regenerateMasterRecoveryCodes(1, "WrongPass123")).rejects.toMatchObject({
      status: 400,
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      role: "master",
      isActive: true,
      passwordHash: validMasterHash,
    });
    const regenerated = await regenerateMasterRecoveryCodes(1, "MasterLama123");
    expect(regenerated.codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(mockTx.masterRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(mockTx.masterRecoveryCode.createMany).toHaveBeenCalledTimes(1);

    // Master redemption succeeds
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      username: "master",
      role: "master",
      isActive: true,
    });
    mockTx.masterRecoveryCode.updateMany.mockResolvedValueOnce({ count: 1 });
    const recRes = await redeemPasswordReset({
      username: "master",
      code: regenerated.codes[0],
      newPassword: "MasterBaru999",
    });
    expect(recRes.method).toBe("recovery_code");
    expect(mockTx.passwordResetRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, status: "APPROVED" },
        data: { status: "EXPIRED", tokenHash: null },
      }),
    );

    // Admin attempting 16-char recovery code is rejected without querying masterRecoveryCode
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 2,
      username: "admin1",
      role: "admin",
      isActive: true,
    });
    mockTx.passwordResetRequest.findFirst.mockResolvedValueOnce(null);
    await expect(
      redeemPasswordReset({
        username: "admin1",
        code: regenerated.codes[0],
        newPassword: "AdminBaru999",
      }),
    ).rejects.toThrow(PasswordResetError);
  });
});
