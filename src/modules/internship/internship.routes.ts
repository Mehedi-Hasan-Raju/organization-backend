import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody } from "../../middlewares/validate.js";

import {
  getPublishedPrograms,
  getAdminPrograms,
  getProgramDetails,
  postProgram,
  patchProgram,
  removeProgram,
  postApplication,
  getOwnApplications,
  getAllApplications,
  patchApplicationReview,
} from "./internship.controller.js";


import {
  postInterview,
  patchInterview,
  deleteInterview,
} from "./interview.controller.js";


const internshipRouter = Router();

const createProgramSchema = z.object({
  title: z.string().trim().min(3).max(150),
  slug: z.string().trim().min(3).max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(10000),
  requirements: z.string().trim().max(5000).optional(),
  seats: z.number().int().min(1).max(10000),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  departmentId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
}).strict();

const updateProgramSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  slug: z.string().trim().min(3).max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().min(10).max(10000).optional(),
  requirements: z.string().trim().max(5000).nullable().optional(),
  seats: z.number().int().min(1).max(10000).optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  departmentId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." },
);

const applySchema = z.object({
  cvUrl: z.string().url().max(2000).optional(),
  coverLetter: z.string().trim().max(5000).optional(),
}).strict();

const reviewSchema = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "SHORTLISTED",
    "INTERVIEW",
    "SELECTED",
    "REJECTED",
  ]),
  adminNote: z.string().trim().max(3000).nullable().optional(),
}).strict();


const createInterviewSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(240).default(30),
  meetingUrl: z.string().url().max(2000).optional(),
  location: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(3000).optional(),
}).strict();

const updateInterviewSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().min(10).max(240).optional(),
  meetingUrl: z.string().url().max(2000).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
  status: z.enum([
    "SCHEDULED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]).optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." },
);




// Publicly available programs for authenticated users
internshipRouter.get(
  "/",
  authenticate,
  getPublishedPrograms,
);

// User application endpoints
internshipRouter.get(
  "/applications/me",
  authenticate,
  authorize("USER", "MODERATOR", "ADMIN"),
  getOwnApplications,
);

internshipRouter.post(
  "/:idOrSlug/applications",
  authenticate,
  authorize("USER"),
  validateBody(applySchema),
  postApplication,
);

// Admin-only program management
internshipRouter.get(
  "/admin/programs",
  authenticate,
  authorize("ADMIN"),
  getAdminPrograms,
);

internshipRouter.post(
  "/admin/programs",
  authenticate,
  authorize("ADMIN"),
  validateBody(createProgramSchema),
  postProgram,
);

internshipRouter.patch(
  "/admin/programs/:idOrSlug",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateProgramSchema),
  patchProgram,
);

internshipRouter.delete(
  "/admin/programs/:idOrSlug",
  authenticate,
  authorize("ADMIN"),
  removeProgram,
);

// Admin-only application review
internshipRouter.get(
  "/admin/applications",
  authenticate,
  authorize("ADMIN"),
  getAllApplications,
);

internshipRouter.patch(
  "/admin/applications/:applicationId",
  authenticate,
  authorize("ADMIN"),
  validateBody(reviewSchema),
  patchApplicationReview,
);

// Keep the generic detail route after the more specific routes
internshipRouter.get(
  "/:idOrSlug",
  authenticate,
  getProgramDetails,
);




//interview 

internshipRouter.post(
  "/admin/applications/:applicationId/interviews",
  authenticate,
  authorize("ADMIN"),
  validateBody(createInterviewSchema),
  postInterview,
);

internshipRouter.patch(
  "/admin/interviews/:interviewId",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateInterviewSchema),
  patchInterview,
);

internshipRouter.delete(
  "/admin/interviews/:interviewId",
  authenticate,
  authorize("ADMIN"),
  deleteInterview,
);


export default internshipRouter;