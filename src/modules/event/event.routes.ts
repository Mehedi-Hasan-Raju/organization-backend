
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import {
  createEventHandler,
  publicEventsHandler,
  publicEventDetailsHandler,
  managedEventsHandler,
  managedEventDetailsHandler,
  updateEventHandler,
  publishEventHandler,
  unpublishEventHandler,
  archiveEventHandler,
  deleteEventHandler,
} from "./event.controller.js";

const router = Router();

// Public routes
router.get("/", publicEventsHandler);
router.get("/slug/:slug", publicEventDetailsHandler);

// Admin / Moderator routes
router.get(
  "/manage",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  managedEventsHandler,
);
router.get(
  "/manage/:id",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  managedEventDetailsHandler,
);
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  createEventHandler,
);
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  updateEventHandler,
);
router.patch(
  "/:id/publish",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  publishEventHandler,
);
router.patch(
  "/:id/unpublish",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  unpublishEventHandler,
);
router.patch(
  "/:id/archive",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  archiveEventHandler,
);
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  deleteEventHandler,
);

export default router;
