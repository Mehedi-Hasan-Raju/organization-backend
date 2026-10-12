import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  DepartmentServiceError,
  listDepartments,
  createDepartment,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
} from "./department.service.js";

function getId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function handleError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof DepartmentServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

export async function getDepartments(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const departments = await listDepartments();

    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postDepartment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const department = await createDepartment(req.body);

    return res.status(201).json({
      success: true,
      message: "Department created successfully.",
      data: department,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getDepartment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const department = await getDepartmentById(getId(req.params.id));

    return res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchDepartment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const department = await updateDepartment(
      getId(req.params.id),
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Department updated successfully.",
      data: department,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function removeDepartment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const department = await deleteDepartment(getId(req.params.id));

    return res.status(200).json({
      success: true,
      message: "Department deleted successfully.",
      data: department,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const member = await addTeamMember(
      getId(req.params.id),
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Team member added successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const member = await updateTeamMember(
      getId(req.params.id),
      getId(req.params.memberId),
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Team member updated successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function deleteTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const member = await removeTeamMember(
      getId(req.params.id),
      getId(req.params.memberId),
    );

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}