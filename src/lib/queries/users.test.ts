import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPrisma, mockRevokeAllSessionsForUser } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockRevokeAllSessionsForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("../session", () => ({
  revokeAllSessionsForUser: mockRevokeAllSessionsForUser,
}));

import { hashPassword, verifyPasswordHash } from "../password";
import { changeOwnPassword, UserError } from "./users";

describe("changeOwnPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing user with 404", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      changeOwnPassword(99, "OldPass1234", "NewPass1234", 5),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects wrong current password with 400 (not 401) so frontend session stays active", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: await hashPassword("RightPass123"),
    });

    try {
      await changeOwnPassword(2, "WrongPass123", "NewPass1234", 5);
      throw new Error("expected UserError");
    } catch (err) {
      expect(err).toBeInstanceOf(UserError);
      expect((err as UserError).status).toBe(400);
    }
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockRevokeAllSessionsForUser).not.toHaveBeenCalled();
  });

  it("rejects when new password is identical to current password", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: await hashPassword("SamePass1234"),
    });

    await expect(
      changeOwnPassword(2, "SamePass1234", "SamePass1234", 5),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects weak new password violating policy", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: await hashPassword("RightPass123"),
    });

    await expect(
      changeOwnPassword(2, "RightPass123", "short", 5),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates scrypt hash and revokes other sessions while keeping caller session", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      passwordHash: await hashPassword("OldPass1234"),
    });
    mockPrisma.user.update.mockResolvedValueOnce({});

    await changeOwnPassword(2, "OldPass1234", "NewStrongPass99", 42);

    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 2 });
    expect(await verifyPasswordHash("NewStrongPass99", updateArg.data.passwordHash)).toBe(true);
    expect(mockRevokeAllSessionsForUser).toHaveBeenCalledWith(2, 42);
  });
});
