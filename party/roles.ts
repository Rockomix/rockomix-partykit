import { getRoleState, saveRoleState } from "./role-state";

export type ClientRole = "HOST" | "COHOST" | "INVITADO";
export type RequestedRole = "host" | "guest";

export async function resolveRole(
  requestedRole: RequestedRole,
  sessionId: string | undefined,
  ctx: DurableObjectState,
): Promise<ClientRole> {
  if (requestedRole === "host") {
    return "HOST";
  }

  if (!sessionId) {
    return "INVITADO";
  }

  const roleState = await getRoleState(ctx);

  if (!roleState.cohostSessionId) {
    roleState.cohostSessionId = sessionId;
    await saveRoleState(ctx, roleState);
    return "COHOST";
  }

  if (roleState.cohostSessionId === sessionId) {
    return "COHOST";
  }

  return "INVITADO";
}
