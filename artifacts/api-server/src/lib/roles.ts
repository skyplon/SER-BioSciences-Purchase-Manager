import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { resolveUserInfo } from "./audit.js";
import { logger } from "./logger.js";

export type Role = "viewer" | "editor" | "admin";

const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

function isRole(v: unknown): v is Role {
  return v === "viewer" || v === "editor" || v === "admin";
}

function getAdminEmails(): string[] {
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export type EffectiveRole = {
  actual: Role;
  effective: Role;
  isImpersonating: boolean;
  isAdminBootstrap: boolean;
};

export async function getActualRole(req: Request): Promise<{ role: Role; isAdminBootstrap: boolean }> {
  const auth = getAuth(req);
  if (!auth?.userId) return { role: "viewer", isAdminBootstrap: false };

  const claims = auth.sessionClaims as { publicMetadata?: { role?: string } } | undefined;
  const claimRole = claims?.publicMetadata?.role;

  const user = await resolveUserInfo(req);
  const adminEmails = getAdminEmails();
  const isBootstrap = !!(user?.userEmail && adminEmails.includes(user.userEmail.toLowerCase()));

  if (isBootstrap) return { role: "admin", isAdminBootstrap: true };
  if (isRole(claimRole)) return { role: claimRole, isAdminBootstrap: false };

  if (auth.userId) {
    try {
      const fullUser = await clerkClient.users.getUser(auth.userId);
      const meta = fullUser.publicMetadata as { role?: string } | undefined;
      if (isRole(meta?.role)) return { role: meta.role, isAdminBootstrap: false };
    } catch (err) {
      logger.warn({ err, userId: auth.userId }, "Failed to fetch Clerk user for role check");
    }
  }

  return { role: "viewer", isAdminBootstrap: false };
}

export async function getEffectiveRole(req: Request): Promise<EffectiveRole> {
  const { role: actual, isAdminBootstrap } = await getActualRole(req);
  const header = req.header("x-impersonate-role");
  if (actual === "admin" && header && isRole(header) && header !== actual) {
    return { actual, effective: header, isImpersonating: true, isAdminBootstrap };
  }
  return { actual, effective: actual, isImpersonating: false, isAdminBootstrap };
}

export function requireRole(min: Role) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { effective } = await getEffectiveRole(req);
      if (ROLE_RANK[effective] >= ROLE_RANK[min]) {
        next();
        return;
      }
      res.status(403).json({ error: `Acceso denegado: se requiere rol ${min}` });
    } catch (err) {
      logger.error({ err }, "requireRole middleware failed");
      res.status(500).json({ error: "Error de autorización" });
    }
  };
}

export async function isActualAdmin(req: Request): Promise<boolean> {
  const { role } = await getActualRole(req);
  return role === "admin";
}
