import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger.js";
import { getEffectiveRole } from "./roles.js";
// `getAuth` is used in resolveUserInfo below; clerkClient too.
void getAuth;
void clerkClient;

/**
 * Back-compat helper: returns true when the EFFECTIVE role is admin. While
 * impersonating, an actual admin will not pass this check.
 */
export async function isAdmin(req: Request): Promise<boolean> {
  const eff = await getEffectiveRole(req);
  return eff.effective === "admin";
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  isAdmin(req)
    .then(async (ok) => {
      if (ok) {
        next();
        return;
      }
      const user = await resolveUserInfo(req).catch(() => null);
      logger.warn({ userId: user?.userId, userEmail: user?.userEmail, path: req.path }, "Admin access denied");
      try {
        await logAudit(req, {
          action: "access_denied",
          entityType: "audit",
          entityLabel: req.path,
          metadata: { path: req.path, method: req.method },
        });
      } catch {
        // already logged inside logAudit
      }
      res.status(403).json({ error: "Acceso denegado: se requiere rol de administrador" });
    })
    .catch((err: unknown) => {
      logger.error({ err }, "requireAdmin middleware failed");
      res.status(500).json({ error: "Error de autorización" });
    });
}

type UserInfo = {
  userId: string;
  userEmail: string | null;
  userName: string | null;
};

const userCache = new Map<string, { info: UserInfo; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveUserInfo(req: Request): Promise<UserInfo | null> {
  const auth = getAuth(req);
  if (!auth?.userId) return null;

  const userId = auth.userId;
  const cached = userCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.info;

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || null;
    const info: UserInfo = { userId, userEmail: email, userName: name };
    userCache.set(userId, { info, expires: Date.now() + CACHE_TTL_MS });
    return info;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to resolve Clerk user for audit log");
    return { userId, userEmail: null, userName: null };
  }
}

export type LogAuditInput = {
  action: string;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAudit(req: Request, input: LogAuditInput): Promise<void> {
  try {
    const user = await resolveUserInfo(req);
    if (!user) {
      logger.warn({ input }, "Audit log skipped — no authenticated user");
      return;
    }

    await db.insert(auditLogsTable).values({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      userId: user.userId,
      userEmail: user.userEmail,
      userName: user.userName,
      changes: input.changes ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, input }, "Failed to write audit log");
  }
}

/**
 * Compute a shallow diff between two snapshots.
 * Returns { field: { before, after } } for changed fields only.
 */
export function diffSnapshots<T extends Record<string, unknown>>(
  before: T,
  after: T,
  ignoreKeys: string[] = ["updatedAt", "createdAt", "imageBase64"],
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (ignoreKeys.includes(key)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}
