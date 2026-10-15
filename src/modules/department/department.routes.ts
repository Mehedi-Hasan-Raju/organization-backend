import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody } from "../../middlewares/validate.js";

import {
  getDepartments,
  postDepartment,
  getDepartment,
  patchDepartment,
  removeDepartment,
  postTeamMember,
  patchTeamMember,
  deleteTeamMember,
} from "./department.controller.js";

const departmentRouter = Router();

const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(1000).optional(),
  headUserId: z.string().min(1).nullable().optional(),
}).strict();

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z.string().trim().min(2).max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  headUserId: z.string().min(1).nullable().optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." },
);

const addMemberSchema = z.object({
  userId: z.string().min(1),
  designation: z.string().trim().min(2).max(100),
  isSupervisor: z.boolean().optional(),
}).strict();

const updateMemberSchema = z.object({
  designation: z.string().trim().min(2).max(100).optional(),
  isSupervisor: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." },
);

// Public directory and department detail.
departmentRouter.get("/", getDepartments);
departmentRouter.get("/:id", getDepartment);

departmentRouter.use(authenticate, authorize("ADMIN"));

// Department CRUD
departmentRouter.post(
  "/",
  validateBody(createDepartmentSchema),
  postDepartment,
);
departmentRouter.patch(
  "/:id",
  validateBody(updateDepartmentSchema),
  patchDepartment,
);
departmentRouter.delete("/:id", removeDepartment);

// Team Member Management
departmentRouter.post(
  "/:id/members",
  validateBody(addMemberSchema),
  postTeamMember,
);
departmentRouter.patch(
  "/:id/members/:memberId",
  validateBody(updateMemberSchema),
  patchTeamMember,
);
departmentRouter.delete(
  "/:id/members/:memberId",
  deleteTeamMember,
);

export default departmentRouter;