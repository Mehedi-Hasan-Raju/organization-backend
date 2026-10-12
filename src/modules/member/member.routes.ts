
import { Router } from "express";
import {
  changeMemberStatus,
  createMember,
  deleteMember,
  getAllMembers,
  getMember,
} from "./member.controller.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/", getAllMembers);
router.get("/:id", getMember);
router.post("/", createMember);
router.patch("/:id/status", changeMemberStatus);
router.delete("/:id", deleteMember);

export default router;
