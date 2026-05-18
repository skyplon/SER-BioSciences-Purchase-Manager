import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const rawLimit = req.query["limit"];
  const limit = rawLimit ? parseInt(String(rawLimit), 10) : 50;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(isNaN(limit) ? 50 : limit);
  res.json(notifications);
});

export default router;
