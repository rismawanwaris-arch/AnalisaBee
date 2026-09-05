import { prisma } from "./prisma";
import type { SessionContext } from "./session";
import { type FeatureKey } from "./features";

export type PermissionSet = "all" | Set<FeatureKey>;

/** master always has everything; an admin-tier session without a custom role
 *  assigned also gets "all" (legacy behavior for accounts predating custom
 *  roles); only an admin-tier session with roleId set is actually narrowed. */
export async function resolveUserPermissions(session: SessionContext): Promise<PermissionSet> {
  if (session.role === "master") return "all";
  if (session.userId === null) return "all"; // env break-glass admin login

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { roleId: true, customRole: { select: { permissions: true } } },
  });
  if (!user?.roleId || !user.customRole) return "all";
  return new Set(user.customRole.permissions.filter((p): p is FeatureKey => true) as FeatureKey[]);
}

export function hasFeature(perms: PermissionSet, key: FeatureKey): boolean {
  return perms === "all" || perms.has(key);
}
