import type { ClientRole } from "./roles";

export function isHost(role: ClientRole): boolean {
  return role === "HOST";
}

export function isCohost(role: ClientRole): boolean {
  return role === "COHOST";
}

export function canPlay(role: ClientRole): boolean {
  return isHost(role) || isCohost(role);
}

export function canPause(role: ClientRole): boolean {
  return isHost(role) || isCohost(role);
}

export function canMarkAsPlayed(role: ClientRole): boolean {
  return isHost(role) || isCohost(role);
}
