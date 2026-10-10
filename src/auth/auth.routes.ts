import { Router } from "express";
import { register, login, getMe } from "./auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);

// Protected route
authRouter.get("/me", authenticate, getMe);

export default authRouter;