
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middlewares/authenticate.js";
import * as service from "./event.service.js";

function getRequiredParam(req: Request, key: "id" | "slug") {
  const value = req.params[key];
  return typeof value === "string" ? value : undefined;
}

export async function createEventHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Please log in." });
      return;
    }

    const event = await service.createEvent(userId, req.body);
    res.status(201).json({ success: true, message: "Event created.", event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function publicEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.getPublicEvents({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      type: typeof req.query.type === "string" ? req.query.type : "",
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function publicEventDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const slug = getRequiredParam(req, "slug");
    if (!slug) {
      res.status(400).json({ success: false, message: "Event slug is required." });
      return;
    }

    const event = await service.getPublicEventBySlug(slug);
    res.json({ success: true, event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function managedEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.getManagedEvents({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      search: typeof req.query.search === "string" ? req.query.search : "",
      status: typeof req.query.status === "string" ? req.query.status : "",
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function managedEventDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    const event = await service.getManagedEventById(id);
    res.json({ success: true, event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function updateEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    const event = await service.updateEvent(id, req.body);
    res.json({ success: true, message: "Event updated.", event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function publishEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    const event = await service.publishEvent(id);
    res.json({ success: true, message: "Event published.", event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function unpublishEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    const event = await service.unpublishEvent(id);
    res.json({ success: true, message: "Event moved to draft.", event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function archiveEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    const event = await service.archiveEvent(id);
    res.json({ success: true, message: "Event archived.", event });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRequiredParam(req, "id");
    if (!id) {
      res.status(400).json({ success: false, message: "Event id is required." });
      return;
    }

    await service.deleteEvent(id);
    res.json({ success: true, message: "Event deleted." });
  } catch (error) {
    if (error instanceof service.EventServiceError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}
