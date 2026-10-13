
import { Router } from "express";
import { getHomepageHandler } from "./homepage.controller.js";

const router = Router();

router.get("/", getHomepageHandler);

export default router;
