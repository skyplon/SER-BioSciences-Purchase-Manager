import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { UpdateUserRoleBody } from "@workspace/api-zod";
import { isActualAdmin } from "../lib/roles.js";
import { logAudit, resolveUserInfo } from "../lib/audit.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function getAdminEmails(): string[] {
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

router.get("/users", async (req, res): Promise<void> => {
  if (!(await isActualAdmin(req))) {
    res.status(403).json({ error: "Acceso denegado: se requiere rol de administrador" });
    return;
  }

  const adminEmails = getAdminEmails();

  try {
    const list = await clerkClient.users.getUserList({ limit: 200, orderBy: "-created_at" });
    const users = list.data.map((u) => {
      const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || null;
      const isBootstrap = !!(email && adminEmails.includes(email.toLowerCase()));
      const meta = u.publicMetadata as { role?: string } | undefined;
      let role: "viewer" | "editor" | "admin" = "viewer";
      if (isBootstrap) role = "admin";
      else if (meta?.role === "admin" || meta?.role === "editor" || meta?.role === "viewer") role = meta.role;
      return {
        id: u.id,
        email,
        name,
        imageUrl: u.imageUrl ?? null,
        role,
        isAdminBootstrap: isBootstrap,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      };
    });
    res.json(users);
  } catch (err) {
    logger.error({ err }, "Failed to list Clerk users");
    res.status(500).json({ error: "Error listando usuarios" });
  }
});

router.patch("/users/:id/role", async (req, res): Promise<void> => {
  if (!(await isActualAdmin(req))) {
    res.status(403).json({ error: "Acceso denegado: se requiere rol de administrador" });
    return;
  }

  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Cuerpo inválido", details: parsed.error.flatten() });
    return;
  }

  const targetId = req.params.id;
  const newRole = parsed.data.role;
  const adminEmails = getAdminEmails();

  try {
    const target = await clerkClient.users.getUser(targetId);
    const targetEmail = target.primaryEmailAddress?.emailAddress ?? target.emailAddresses[0]?.emailAddress ?? null;
    const isBootstrap = !!(targetEmail && adminEmails.includes(targetEmail.toLowerCase()));

    if (isBootstrap && newRole !== "admin") {
      res.status(400).json({ error: "Este usuario está en ADMIN_EMAILS y no puede ser degradado" });
      return;
    }

    const currentMeta = (target.publicMetadata ?? {}) as Record<string, unknown>;
    const previousRole = (currentMeta.role as string | undefined) ?? (isBootstrap ? "admin" : "viewer");

    await clerkClient.users.updateUserMetadata(targetId, {
      publicMetadata: { ...currentMeta, role: newRole },
    });

    const actor = await resolveUserInfo(req);
    await logAudit(req, {
      action: "role_changed",
      entityType: "user",
      entityLabel: targetEmail ?? targetId,
      changes: { role: { before: previousRole, after: newRole } },
      metadata: { targetUserId: targetId, actorUserId: actor?.userId ?? null },
    });

    const name = [target.firstName, target.lastName].filter(Boolean).join(" ").trim() || target.username || null;
    res.json({
      id: target.id,
      email: targetEmail,
      name,
      imageUrl: target.imageUrl ?? null,
      role: newRole,
      isAdminBootstrap: isBootstrap,
      createdAt: target.createdAt ? new Date(target.createdAt).toISOString() : null,
      lastSignInAt: target.lastSignInAt ? new Date(target.lastSignInAt).toISOString() : null,
    });
  } catch (err) {
    logger.error({ err, targetId }, "Failed to update user role");
    res.status(500).json({ error: "Error actualizando rol" });
  }
});

export default router;
