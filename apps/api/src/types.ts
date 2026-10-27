import type { UserRole } from "./auth.js";

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: "active" | "inactive";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- declaration merging requerido por Express
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export {};
