import type { DeployActor } from "@/lib/server/deploy-store.server";

export async function requireDeployActor(
  request: Request,
): Promise<{ authorized: true; actor: DeployActor } | { authorized: false; actor: null }> {
  const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
  const { hasValidAdminKey } = await import("@/lib/server/db-auth.server");

  if (hasValidAdminKey(request)) {
    return {
      authorized: true,
      actor: {
        id: "usr_sparrowx_admin",
        email: "admin@sparrowx.net",
        fullName: "SparrowX Admin",
        role: "admin",
      },
    };
  }

  const claims = await readMasterSsoFromRequest(request);
  if (!claims) {
    return { authorized: false, actor: null };
  }

  return {
    authorized: true,
    actor: {
      id: claims.sub,
      email: claims.email,
      fullName: claims.fullName,
      role: claims.role,
    },
  };
}
