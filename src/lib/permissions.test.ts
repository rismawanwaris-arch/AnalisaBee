import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasFeature, resolveUserPermissions } from "./permissions";
import { prisma } from "./prisma";
import type { SessionContext } from "./session";

vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("permissions: hasFeature & resolveUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows master session access to every feature without querying DB", async () => {
    const session: SessionContext = {
      role: "master",
      username: "master",
      userId: 1,
      sessionId: 10,
    };
    const perms = await resolveUserPermissions(session);
    expect(perms).toBe("all");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(hasFeature(perms, "dashboard")).toBe(true);
    expect(hasFeature(perms, "points_atensi")).toBe(true);
  });

  it("strips unknown/stale keys from customRole.permissions and keeps valid keys", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      roleId: 5,
      customRole: {
        permissions: ["dashboard", "points_cimahi", "points_cimahi_atensi", "unknown_legacy_key", "__proto__"],
      },
    } as any);

    const session: SessionContext = {
      role: "admin",
      username: "kasir_cimahi",
      userId: 2,
      sessionId: 11,
    };
    const perms = await resolveUserPermissions(session);
    expect(perms).toBeInstanceOf(Set);
    const set = perms as Set<string>;
    expect(set.has("dashboard")).toBe(true);
    expect(set.has("points_cimahi")).toBe(true);
    expect(set.has("points_cimahi_atensi")).toBe(true);
    expect(set.has("unknown_legacy_key")).toBe(false);
    expect(set.has("__proto__")).toBe(false);
  });

  it("grants points_cimahi_tg/petshop/sp when custom role has points_cimahi", () => {
    const perms = new Set(["points_cimahi"] as const) as Set<any>;
    expect(hasFeature(perms, "points_cimahi")).toBe(true);
    expect(hasFeature(perms, "points_cimahi_tg")).toBe(true);
    expect(hasFeature(perms, "points_cimahi_petshop")).toBe(true);
    expect(hasFeature(perms, "points_cimahi_sp")).toBe(true);
    expect(hasFeature(perms, "points_atensi")).toBe(false);
    expect(hasFeature(perms, "points_cimahi_atensi")).toBe(false);
  });
});
