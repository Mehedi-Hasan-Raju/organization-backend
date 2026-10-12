
import { Router } from "express";
import {
  deleteNoticeHandler,
  getAdminNotice,
  getAllAdminNotices,
  getPublicNotice,
  getPublicNotices,
  patchNotice,
  postNotice,
  publishNoticeHandler,
  unpublishNoticeHandler,
} from "./notice.controller.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";

const router = Router();

// Public routes
router.get("/", getPublicNotices);
router.get("/admin", authenticate, authorize("ADMIN", "MODERATOR"), getAllAdminNotices);
router.get("/admin/:id", authenticate, authorize("ADMIN", "MODERATOR"), getAdminNotice);
router.get("/:slug", getPublicNotice);

// Admin routes
router.post("/", authenticate, authorize("ADMIN", "MODERATOR"), postNotice);
router.patch("/:id", authenticate, authorize("ADMIN", "MODERATOR"), patchNotice);
router.patch("/:id/publish", authenticate, authorize("ADMIN", "MODERATOR"), publishNoticeHandler);
router.patch("/:id/unpublish", authenticate, authorize("ADMIN", "MODERATOR"), unpublishNoticeHandler);
router.delete("/:id", authenticate, authorize("ADMIN", "MODERATOR"), deleteNoticeHandler);

export default router;
