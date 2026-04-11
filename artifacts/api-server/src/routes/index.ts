import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoicesRouter from "./invoices";
import ocrRouter from "./ocr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoicesRouter);
router.use(ocrRouter);

export default router;
