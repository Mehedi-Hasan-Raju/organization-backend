# YSSE NGO Backend API

A modular REST API backend for the YSSE NGO platform, built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL. It supports authentication, role-based access control, department and team management, internship recruitment, notices, courses, events, user dashboards, and homepage data.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Run the Project](#run-the-project)
- [API Endpoints](#api-endpoints)
- [Authentication and Authorization](#authentication-and-authorization)
- [File Uploads](#file-uploads)
- [Security Notes](#security-notes)
- [Development Status](#development-status)

## Overview

The YSSE NGO Backend provides REST APIs for managing NGO operations and website content. The codebase is organized into feature-based modules, with routes, controllers, and services separated to keep the application maintainable.

The backend uses PostgreSQL as its database and Prisma ORM for database access. Authentication is handled with JSON Web Tokens (JWT), passwords are hashed with bcrypt, and Cloudinary is used for uploaded media and documents.

## Technology Stack

| Technology | Purpose |
| --- | --- |
| Node.js | JavaScript runtime |
| Express.js | HTTP server and REST API framework |
| TypeScript | Type-safe backend development |
| PostgreSQL | Relational database |
| Neon | Hosted PostgreSQL database |
| Prisma ORM 7 | Database queries and schema management |
| JWT | Token-based authentication |
| bcrypt | Password hashing |
| Zod | Request data validation |
| Helmet | HTTP security headers |
| CORS | Cross-origin request configuration |
| Nodemailer | Email verification and password reset emails |
| Multer | Multipart file upload handling |
| Cloudinary | Cloud media and document storage |
| dotenv | Environment variable configuration |

## Architecture

The application follows a feature-based modular architecture. Most modules separate responsibilities into three layers:

- **Routes:** Define API endpoints and attach middleware.
- **Controllers:** Handle HTTP requests and responses.
- **Services:** Implement business logic and database operations.

### Request Flow

```text
Client / Frontend
       |
       v
Express Routes
       |
       v
Middleware (authentication, authorization, validation)
       |
       v
Controller
       |
       v
Service Layer
       |
       v
Prisma ORM
       |
       v
PostgreSQL (Neon)
```

This structure helps keep business logic separate from HTTP handling and makes individual modules easier to maintain.

## Features

### Authentication and Account Security

- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Email verification using time-limited codes
- Resend email verification
- Forgot-password and reset-password flows
- Role-based access control
- Account status management

### Admin Management

- Dashboard statistics
- Create and manage user accounts
- Search and paginate user listings
- Update user roles and statuses
- Safeguards for sensitive admin account changes

### Departments and Team Members

- Department management
- Department activation status
- Department heads
- Team membership management
- Designations and supervisor assignments

### Internship Recruitment

- Internship program management
- Draft, published, and closed program statuses
- Publicly available internship listings
- Internship applications
- Application review and status updates
- Interview scheduling and management

### Notices

- Create and manage notices
- Draft and published statuses
- Public listing of published notices
- Publish and unpublish controls

### Courses and Learning

- Course management
- Course modules and lessons
- Lesson preview support
- Course enrollment
- Lesson progress tracking
- Demo payment records

> **Payment note:** The current payment flow is for demonstration purposes. A real payment gateway must be integrated before accepting live payments.

### Events

- Event creation and management
- Event descriptions, dates, locations, and images
- Draft, published, and archived statuses
- Public event listings and details

### User Dashboard

- User profile information
- Internship application history
- Course enrollments and progress
- Dashboard overview data
- Profile avatar upload and removal, where configured

### Homepage API

Provides public homepage data, including:

- Member and department statistics
- Open internship programs
- Published courses
- Published notices
- Upcoming events
- Active team members

### Uploads

- Image uploads through Multer and Cloudinary
- PDF document upload support
- File-content type checks
- Cloudinary asset deletion support for profile images, where configured

## Project Structure

The exact structure may evolve as modules are added. The main structure follows this pattern:

```text
src/
├── config/
│   ├── cloudinary.ts
│   └── prisma.ts
├── middleware/
│   ├── authentication / authorization middleware
│   └── error handling and validation middleware
├── modules/
│   ├── auth/
│   ├── admin/
│   ├── department/
│   ├── member/
│   ├── internship/
│   ├── notice/
│   ├── course/
│   ├── event/
│   ├── upload/
│   ├── user-dashboard/
│   └── homepage/
├── app.ts
└── server.ts
prisma/
├── schema.prisma
└── migrations/
generated/
└── prisma/
```

A typical feature module uses separate files:

```text
feature/
├── feature.routes.ts
├── feature.controller.ts
└── feature.service.ts
```

## Getting Started

### Prerequisites

Install or prepare:

- Node.js (a version supported by the installed dependencies)
- npm
- PostgreSQL, or a Neon PostgreSQL database
- Cloudinary account for file uploads
- SMTP credentials for email functionality

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

Replace the placeholders with your repository URL and folder name.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root. Use the variable names expected by your configuration files.

Example template:

```env
NODE_ENV=development
PORT=5000

DATABASE_URL="your_postgresql_connection_string"

JWT_SECRET="replace_with_a_long_random_secret"
JWT_EXPIRES_IN="10d"

# SMTP / Nodemailer — adapt names to your mail configuration
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="your_email@example.com"
SMTP_PASS="your_email_app_password"

# Cloudinary — adapt names to src/config/cloudinary.ts
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# Configure according to the CORS setup in the application
CLIENT_URL="http://localhost:3000"
```

**Important:** These are example variable names. Check the project's configuration files and use the exact names they read. Never commit real secrets or production credentials.

## Database Setup

After configuring the database connection, validate the Prisma schema and generate the client:

```bash
npx prisma validate
npx prisma generate
```

If the project uses Prisma migrations, apply them in your development environment:

```bash
npx prisma migrate dev
```

For a deployed environment, use the migration workflow intended for deployment, such as:

```bash
npx prisma migrate deploy
```

Ensure Prisma's datasource and configuration match the installed Prisma 7 setup before running database commands.

## Run the Project

Use the scripts already defined in `package.json`. Common examples are:

```bash
npm run dev
```

Build the TypeScript project:

```bash
npm run build
```

Run the compiled application if a `start` script is configured:

```bash
npm start
```

The local API is configured to run at:

```text
http://localhost:5000
```

The health endpoint, if mounted as configured, is:

```text
GET http://localhost:5000/api/v1/health
```

## API Endpoints

The API is versioned under `/api/v1`. The endpoint list below summarizes the main modules; exact route names and supported HTTP methods should be checked in each module's route file.

| Module | Base path | Purpose |
| --- | --- | --- |
| Health | `/api/v1/health` | Service health check |
| Authentication | `/api/v1/auth` | Register, login, verification, and password reset |
| Admin | `/api/v1/admin` | Admin dashboard and user management |
| Departments | `/api/v1/departments` | Department operations |
| Members | `/api/v1/members` | Team member management |
| Internships | `/api/v1/internships` | Internship programs and applications |
| Notices | `/api/v1/notices` | Notice management and public notices |
| Courses | `/api/v1/courses` | Courses, modules, lessons, and enrollment |
| Events | `/api/v1/events` | Event management and public event data |
| Uploads | `/api/v1/uploads` | Image and PDF upload operations |
| User Dashboard | `/api/v1/user-dashboard` | Profile, applications, courses, and overview |
| Homepage | `/api/v1/homepage` | Public homepage content and statistics |

> Base paths may differ depending on the route mounts in `app.ts`. Check the application file and module routes for the exact paths.

### Example: Fetch Homepage Data

```http
GET /api/v1/homepage
```

Example response shape:

```json
{
  "success": true,
  "message": "Homepage data fetched successfully.",
  "data": {
    "statistics": {
      "totalMembers": 0,
      "totalDepartments": 0,
      "totalOpenInternships": 0,
      "totalPublishedCourses": 0
    },
    "internships": [],
    "courses": [],
    "notices": [],
    "events": [],
    "teamMembers": []
  }
}
```

The values above are illustrative; actual values depend on the database.

## Authentication and Authorization

Protected endpoints require a valid JWT using the authentication format configured by the application, commonly:

```http
Authorization: Bearer <your_access_token>
```

The system uses role-based access control with these roles:

- `USER`
- `MODERATOR`
- `ADMIN`

Access should be restricted according to each route's authentication and authorization middleware.

## File Uploads

Uploaded images and PDF documents are stored in Cloudinary. Upload routes use multipart form data, and the file field name must match the configured Multer route.

Do not assume a specific upload endpoint or field name without checking the upload route and middleware configuration.

## Security Notes

- Keep `.env` out of version control.
- Use strong, unique secrets for JWT and other credentials.
- Never commit database URLs, SMTP passwords, Cloudinary secrets, or access tokens.
- Validate incoming request data.
- Apply authentication and role authorization to protected routes.
- Use HTTPS and production-appropriate CORS settings when deploying.
- Configure backups and database access controls for the hosted database.
- Integrate and verify a real payment provider before handling live payments.

## Development Status

This project includes modules for authentication, administration, departments and team members, internship recruitment, notices, courses, events, uploads, user dashboard functionality, and homepage data.

Before deployment, run the project's validation/build commands, test protected and public endpoints, verify environment configuration, and review authorization rules and upload handling.


