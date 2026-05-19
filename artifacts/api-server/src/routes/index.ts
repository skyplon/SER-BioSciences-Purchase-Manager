import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
import invoicesRouter from "./invoices";
import notificationsRouter from "./notifications";
import ocrRouter from "./ocr";
import auditRouter from "./audit";
import usersRouter from "./users";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}

router.use(healthRouter);
router.use(requireAuth);
router.use(invoicesRouter);
router.use(notificationsRouter);
router.use(ocrRouter);
router.use(auditRouter);
router.use(usersRouter);

export default router;
