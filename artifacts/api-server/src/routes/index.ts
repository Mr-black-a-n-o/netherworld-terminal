import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import signalsRouter from "./signals";
import tradesRouter from "./trades";
import assetsRouter from "./assets";
import statsRouter from "./stats";
import usersRouter from "./users";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(signalsRouter);
router.use(tradesRouter);
router.use(assetsRouter);
router.use(statsRouter);
router.use(usersRouter);
router.use(profileRouter);

export default router;
