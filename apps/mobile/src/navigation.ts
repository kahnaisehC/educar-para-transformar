import type { UserRole } from "./types";

export function homePath(role: UserRole): string {
  if (role === "parent") return "/parent";
  if (role === "admin" || role === "director") return "/admin";
  return "/perfil";
}
