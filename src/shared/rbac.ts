import { ROLE_HIERARCHY } from "./constants";
import type { Role } from "./types";

export function hasRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}

export function isAuthorOrAbove(role: Role): boolean {
  return hasRole(role, "author");
}
