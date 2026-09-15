import type { UserRole } from "./auth.js";

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: "active" | "inactive";
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export {};
