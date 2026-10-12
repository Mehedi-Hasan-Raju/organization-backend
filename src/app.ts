
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./config/prisma.js";

import authRouter from "./auth/auth.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import departmentRouter from "./modules/department/department.routes.js";
import internshipRouter from "./modules/internship/internship.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/departments", departmentRouter);
app.use("/api/v1/internships", internshipRouter);


app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "YSSE API is running",
  });
});



app.get("/api/v1/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Database connected successfully",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});


export default app;
