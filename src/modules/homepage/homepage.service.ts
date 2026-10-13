
import {
  CourseStatus,
  EventStatus,
  InternshipProgramStatus,
  NoticeStatus,
  TeamMemberStatus,
  UserStatus,
} from "../../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";

export async function getHomepageData() {
  const now = new Date();

  const openInternshipFilter = {
    status: InternshipProgramStatus.PUBLISHED,
    OR: [
      { deadline: null },
      { deadline: { gte: now } },
    ],
  };

  const [
    totalMembers,
    totalDepartments,
    totalInternships,
    totalCourses,
    internships,
    courses,
    notices,
    events,
    teamMembers,
  ] = await Promise.all([
    // Count unique active users who are active department members.
    prisma.user.count({
      where: {
        status: UserStatus.ACTIVE,
        teamMemberships: {
          some: {
            status: TeamMemberStatus.ACTIVE,
            department: {
              isActive: true,
            },
          },
        },
      },
    }),

    prisma.department.count({
      where: { isActive: true },
    }),

    prisma.internshipProgram.count({
      where: openInternshipFilter,
    }),

    prisma.course.count({
      where: { status: CourseStatus.PUBLISHED },
    }),

    prisma.internshipProgram.findMany({
      where: openInternshipFilter,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        requirements: true,
        seats: true,
        deadline: true,
        publishedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 6,
    }),

    prisma.course.findMany({
      where: {
        status: CourseStatus.PUBLISHED,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        thumbnailUrl: true,
        price: true,
        durationHours: true,
        publishedAt: true,
        _count: {
          select: {
            modules: true,
          },
        },
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 6,
    }),

    prisma.notice.findMany({
      where: {
        status: NoticeStatus.PUBLISHED,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 5,
    }),

    prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startDate: { gte: now },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        imageUrl: true,
        location: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
      take: 6,
    }),

    prisma.teamMember.findMany({
      where: {
        status: TeamMemberStatus.ACTIVE,
        user: {
          status: UserStatus.ACTIVE,
        },
        department: {
          isActive: true,
        },
      },
      select: {
        id: true,
        designation: true,
        isSupervisor: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { isSupervisor: "desc" },
        { joinedAt: "desc" },
      ],
      take: 8,
    }),
  ]);

  return {
    statistics: {
      totalMembers,
      totalDepartments,
      totalOpenInternships: totalInternships,
      totalPublishedCourses: totalCourses,
    },
    internships,
    courses: courses.map(({ _count, ...course }) => ({
      ...course,
      totalModules: _count.modules,
    })),
    notices,
    events,
    teamMembers,
  };
}
