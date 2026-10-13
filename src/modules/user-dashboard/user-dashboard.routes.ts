
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { upload } from "../upload/upload.middleware.js";
import {
  getDashboardOverviewHandler,
  getMyProfileHandler,
  updateMyProfileHandler,
  getMyApplicationsHandler,
  getMyDashboardCoursesHandler,
  
} from "./user-dashboard.controller.js";
import {
  uploadMyAvatarHandler,
  removeMyAvatarHandler,
} from "./avatar.controller.js";

const router = Router();

router.use(authenticate);

router.post("/avatar", upload.single("file"), uploadMyAvatarHandler);
router.delete("/avatar", removeMyAvatarHandler);


router.get("/overview", getDashboardOverviewHandler);

router.get("/profile", getMyProfileHandler);
router.patch("/profile", updateMyProfileHandler);

router.get("/applications", getMyApplicationsHandler);
router.get("/courses", getMyDashboardCoursesHandler);



export default router;
