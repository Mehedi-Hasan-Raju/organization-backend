
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody } from "../../middlewares/validate.js";
import {
  createAdminManagedUser,
  adminDashboard,
  listUsers,
  getUserDetails,
  changeUserRole,
  changeUserStatus,
} from "./admin.controller.js";

const adminRouter = Router();

const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(72),
    role: z.enum(["USER", "MODERATOR", "ADMIN"]),
  })
  .strict();

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

// All routes in this router require an ADMIN.
adminRouter.use(authenticate, authorize("ADMIN"));

// GET /api/v1/admin/dashboard
adminRouter.get("/dashboard", adminDashboard);

// POST /api/v1/admin/users
adminRouter.post(
  "/users",
  validateBody(createUserSchema),
  createAdminManagedUser
);

// GET /api/v1/admin/user
adminRouter.get("/users", listUsers);

// GET /api/v1/admin/users/:id
adminRouter.get("/users/:id", getUserDetails);

// PATCH /api/v1/admin/users/:id/role
adminRouter.patch(
  "/users/:id/role",
  validateBody(updateRoleSchema),
  changeUserRole
);

// PATCH /api/v1/admin/users/:id/status
adminRouter.patch(
  "/users/:id/status",
  validateBody(updateStatusSchema),
  changeUserStatus
);

export default adminRouter;
