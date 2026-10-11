
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody } from "../../middlewares/validate.js";
import {
  adminDashboard,
  listUsers,
  changeUserRole,
  changeUserStatus,
} from "./admin.controller.js";

const adminRouter = Router();

const updateRoleSchema = z
  .object({
    role: z.enum(["USER", "MODERATOR", "ADMIN"]),
  })
  .strict();

const updateStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  })
  .strict();

// GET /api/v1/admin/dashboard
adminRouter.get(
  "/dashboard",
  authenticate,
  authorize("ADMIN"),
  adminDashboard
);

// GET /api/v1/admin/users?page=1&limit=10&search=raju&role=USER&status=ACTIVE
adminRouter.get(
  "/users",
  authenticate,
  authorize("ADMIN"),
  listUsers
);

// PATCH /api/v1/admin/users/:id/role
adminRouter.patch(
  "/users/:id/role",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateRoleSchema),
  changeUserRole
);

// PATCH /api/v1/admin/users/:id/status
adminRouter.patch(
  "/users/:id/status",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateStatusSchema),
  changeUserStatus
);

export default adminRouter;
