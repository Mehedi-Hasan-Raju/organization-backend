
import { Router } from "express";
import {
  register,
  login,
  getMe,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  changePassword,
} from "./auth.controller.js";


import { authenticate } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validate.js";
import { authRateLimiter } from "../middlewares/rateLimiter.js";


import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.validation.js";


const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(registerSchema),
  register
);

authRouter.post(
  "/login",
  authRateLimiter,
  validateBody(loginSchema),
  login
);

authRouter.post(
  "/verify-email",
  authRateLimiter,
  validateBody(verifyEmailSchema),
  verifyEmail
);

authRouter.post(
  "/resend-verification",
  authRateLimiter,
  validateBody(resendVerificationSchema),
  resendVerificationCode
);

authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword
);

authRouter.post(
  "/reset-password",
  authRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
);

authRouter.post(
  "/change-password",
  authRateLimiter,
  authenticate,
  validateBody(changePasswordSchema),
  changePassword,
);

authRouter.get("/me", authenticate, getMe);

export default authRouter;
