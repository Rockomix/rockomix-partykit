type RoleState = {
  cohostSessionId: string | null;
};

const ROLE_STATE_KEY = "role-state";

export async function getRoleState(ctx: DurableObjectState): Promise<RoleState> {
  const stored = await ctx.storage.get<RoleState>(ROLE_STATE_KEY);
  return stored ?? { cohostSessionId: null };
}

export async function saveRoleState(
  ctx: DurableObjectState,
  state: RoleState,
): Promise<void> {
  await ctx.storage.put(ROLE_STATE_KEY, state);
}
