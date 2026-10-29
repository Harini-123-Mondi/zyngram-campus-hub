# Zyngram Campus Hub

A local, responsive Campus Hub MVP built with React, Node.js/Express, and MongoDB. It uses the supplied Zyngram logo and a calm sage-and-teal visual theme.

## What is implemented

- Student self-registration using their name and chosen password; the backend generates a unique name-based ZIN ID and matching `@zyngram.com` login email. Personal profiles support private photo and PDF resume uploads, learning badges, and earned course certificates.
- Admin-managed learning modules with create, read, update, and delete operations.
- Courses in frontend and full-stack web development, backend APIs, databases, artificial intelligence, machine learning, and data structures and algorithms, plus tasks and feedback, attendance, announcements, and private support requests.
- Role-aware student, trainer, coordinator, administrator, and placement-officer workspaces, including a learning dashboard, lessons, notes, quizzes, assignment submission/review, attendance marking and analytics, timetable, discussions and study groups, personalized learning paths, points, careers, and placement progress.
- A dedicated trainer workspace with a Trainer ID, assigned-course and batch overview, student progress and attendance, course creation, notes/PDF/link sharing, batch-scoped attendance, assignment evaluation, editable class schedules, course announcements, student Q&A, reports, profile, support, and secure logout. Trainer course views do not show student certificate screens; assignment creation and evaluation remain available in their own workspace.
- A campus coordinator workspace with a campus-wide activity dashboard, student search/filter and batch reassignment, read-only trainer profiles and workload, batch creation/editing/status and capacity management, weekly timetable scheduling with trainer/room conflict checks, attendance monitoring and alerts, assignment follow-up without grading access, editable campus events, batch-targeted announcements, request status tracking, campus reports, notifications, coordinator ID, and support. Coordinator authorization cannot change roles or record attendance; administrators retain account-permission control and trainers retain assignment grading.
- An administrator workspace with a live campus dashboard and clickable counts, account creation/search/profile/role/access management, password resets, role-permission guidance, course catalog management, batch and schedule tools, attendance/reports, role-targeted announcements, support requests, security policy settings, and searchable administrative audit history. Administrator-only APIs enforce access on the server, password hashes are never exposed, inactive accounts cannot sign in, and account changes revoke active sessions.
- An administrator-only API management console with API and consumer CRUD, OpenAPI JSON export, hashed consumer API keys that are shown only once, key rotation/revocation, per-consumer request limits, and request activity logs. API keys currently protect the two seeded secure demo endpoints; the remaining Campus Hub APIs continue to use signed-in sessions.
- A placement-officer workspace with dynamic placement metrics, private student placement profiles and authorized resume review, company contacts, jobs/internships, registration-driven placement drives, application status and shortlist workflows, interview scheduling and attendance, verified offers and joining status, eligible-student notifications, career preparation resources, and placement analytics. Students maintain skills, CGPA, graduation year, and course details, then apply or register only when eligible; duplicate applications are prevented and placement APIs enforce officer/student permissions on the server.
- Every seeded software course has a course introduction and a full-width four-module, eight-week roadmap. Each topic includes an explanation and a related YouTube video search; learners mark every topic complete before the module assignment unlocks. Each assignment mixes four concept MCQs with a code-reading MCQ about output, bugs or algorithm behavior. A learner must score at least 70% to pass and unlock the next module; failed assessments can be retried. The certificates page tracks lesson and assignment completion for each enrolled course, then shows and downloads a personalized landscape PDF with the learner name, completed course, award date, unique certificate ID and completion seal.
- Campus events support coordinator/admin publishing, student registration, and capacity limits. Coordinators/admins can create course batches, assign trainers, and allocate learners with enrollment and capacity checks.
- A campus assistant with built-in study guidance; an optional OpenAI-compatible provider can be configured using server-side environment variables.
- Responsive navigation and layouts, keyboard-visible focus, labelled forms, and helpful loading/error states.
- The public sign-in page introduces the Campus Hub's vision and mission, learning and campus activities, placement preparation, and student benefits in separate responsive sections.
- Profile photos (PNG/JPG/WebP, up to 1.5 MB) and PDF resumes (up to 2 MB) are validated and stored with the student's MongoDB account; only that signed-in student can view, download, replace, or remove them. The profile dashboard summarizes completion, learning points, badges, and earned certificates.
- MongoDB persistence for accounts, courses/workflow state, learning content, assignments, attendance, community data, and gamification, plus a health check at `/api/health`.

## Prerequisites

- Windows 10/11 (commands below use PowerShell), Node.js 20 or later, and npm.
- MongoDB Community Server running locally. MongoDB Compass is optional.

## First-time local setup

1. Start the **MongoDB** Windows service (open PowerShell as Administrator if required):

   ```powershell
   Start-Service MongoDB
   ```

2. From the project directory, install packages. For the default local MongoDB setup, the app connects to `mongodb://127.0.0.1:27017` and creates its database, collections, indexes, and sample records on first start. Edit the existing `.env` file (or copy `.env.example` to `.env` if it does not exist) to configure a different database or optional AI provider:

   ```powershell
   npm install
   ```

   Set `MONGODB_URI` and optionally `MONGODB_DB` when needed. For the optional assistant provider, obtain your own API key from your provider account, then set `AI_BASE_URL` to its HTTPS API base ending in `/v1`, `AI_API_KEY` to that private key, and `AI_MODEL` to a model available to your account. All three values must be present together. Never share the key in chat, frontend settings, screenshots, or source control; keep it only in `.env` or a deployment secret store. With all three blank, built-in study guidance stays available; `/api/ai/status` reports only the mode and missing variable names, never values.

3. Start the development app:

   ```powershell
   npm run dev
   ```

   Open the Vite URL printed in the terminal, normally `http://localhost:5173`. The React app runs on port 5173 and the Express API on port 4000. Leave the terminal running while using the app.

4. Confirm database connectivity:

   ```powershell
   Invoke-RestMethod http://localhost:4000/api/health
   ```

   A successful response is `status: ok` and `database: connected`.

## Start, stop, and production build

- Development: `npm run dev`; stop both processes with **Ctrl+C** in that terminal.
- Production build: `npm run build`.
- Serve the built frontend and API together: set `$env:NODE_ENV = "production"` and run `npm start`; open `http://localhost:4000`. Stop with **Ctrl+C**.
- User, module, course workflow, learning-content, event, batch, attendance, and assignment records persist in MongoDB. The bundled campus JSON is used as a one-time initial data source on a fresh database. Restarting the app does not reset saved MongoDB state.
- Remove the `NODE_ENV` setting from a PowerShell session with `Remove-Item Env:NODE_ENV` when no longer needed.

## Test accounts

These public sample accounts are only for local demonstration:

| Role | Email | Password |
| --- | --- | --- |
| Trainee | `student@zyngram.demo` | `learn123` |
| Trainer | `trainer@zyngram.com` | `teach123` (temporary) |
| Coordinator | `coordinator@zyngram.com` | `campus123` (temporary) |
| Administrator | `admin@zyngram.com` | `admin123` (temporary) |
| Placement Officer | `placement@zyngram.com` | `career123` (temporary) |

Staff use their temporary credentials once, then create a personal password at first sign-in. The temporary passwords above are for the local demo seed only. Existing staff logins are migrated to the `@zyngram.com` addresses above, with their previous email retained as a sign-in alias. The `@zyngram.com` address is the app's login identity, not a provisioned mailbox; the app does not send email or password-reset links.

New students provide their name, create a password, and confirm it. The backend uses the first name's first and last two letters around unique digits (for example, `Harini` gets an ID beginning `HA` and ending `NI`) and creates a matching `@zyngram.com` login email; the ZIN ID or full email works at student sign-in. Existing IDs from the earlier fixed `IN...IH` format are migrated on server startup, while the previous ID remains a sign-in alias. Users cannot register themselves as administrators. The demo accounts are seeded into MongoDB only when its `users` collection is empty.

## Verification checklist

Run automated validation tests, live API integration tests (requires MongoDB running locally), and the frontend production build:

```powershell
npm test
npm run test:integration
npm run build
```

The API integration test uses an isolated temporary MongoDB database, checks registration and login failures, role restrictions, profile editing, lessons/notes/quizzes and the four-module assignment roadmap for every course, course introductions, explained topics and related videos, mixed conceptual/code-reading assessments, topic-completion gating, module locks and score-based progression, eligible and ineligible PDF certificates, local assistant responses, assignment submit/review protections, event registration capacity, batch trainer/learner allocation, study groups, placement progress, attendance marking, admin module CRUD, API registry CRUD and duplicate rejection, consumer/key issuance and hash-only persistence, invalid-key authentication, endpoint permission enforcement, rate limiting, key rotation/revocation, consumer suspension/reactivation, API usage metrics, OpenAPI path/security documentation, and saved data after an API restart, then removes its temporary database and sample-data file.

For the browser demonstration, follow the checklist above:

1. Register with your name and a password of at least eight characters containing a letter and a number. Confirm a unique ZIN ID/email is generated and mismatched passwords are rejected.
2. Sign in using the generated ZIN ID or its full `@zyngram.com` email. Try a wrong password and a mismatched selected role; neither should create a session.
3. Open **My profile**, update your personal details, save, then sign out and back in to confirm the profile is retained.
4. Sign in as the trainee and confirm the **Learning modules** page is read-only. Attempting module `POST`, `PATCH`, or `DELETE` through the API as a trainee should return `403`.
5. Sign in as `admin@zyngram.com`; create a module, edit its details, and delete it. Confirm it appears for the trainee and remains saved after restarting the app.
6. Use student and trainer accounts to test task and assignment submission/review, study-group creation, and the campus assistant. Use a trainer account to record learner attendance; use a student account to check in and update placement preparation progress.
7. Open a course roadmap and read its introduction. For each unlocked module, open every topic, read its explanation, follow the related-video link, and mark it complete. Verify the module assignment stays locked until every topic is complete; then submit it and confirm a score below 70% leaves the next module locked while a passing score unlocks it. Complete every module assignment and available lesson to download the course certificate PDF; check the Zyngram stamp and certificate ID. Sign in as a coordinator/admin to publish an event, create a batch, assign a trainer, and allocate students; confirm event registrations and batch capacity are enforced.
8. Restart the application and confirm the saved module, account, profile name, and sample workflow records remain available. Check `/api/health` again.

The automated suites cover validation, authentication and role access, profile and database persistence, all-course learning content, stamped PDF eligibility, local and configured AI-provider responses, assignment review, attendance marking, event registration limits, and batch allocation capacity.

## Database and local data

MongoDB collections created by the app:

- `users`, `modules`, and `campus_state`: accounts and role/profile data, learning modules, and the existing course/task/attendance/announcement workflow state.
- Platform collections for course modules, topic completion and assignment attempts, lessons, resources, quizzes, timetable, assignments/submissions, events and registrations, course batches and allocations, discussion groups/posts, learning progress, gamification, placement companies/jobs/drives/profiles/applications/interviews/offers, administrator audit logs, system settings, and API management (`api_registry`, `api_consumers`, `api_keys`, `api_usage_logs`).

The legacy JSON file is used as the initial seed/import source when `campus_state` is first created; subsequent workflow changes persist in MongoDB. MongoDB user records and platform collections are persisted independently. The server enforces role checks for protected actions.

## Day 24 — API Management

The administrator sidebar includes an **API Management** page with a registry, consumer/key controls, and request activity:

- The registry persists API identifiers, names, descriptions, owning modules, base URLs, endpoint paths, methods, versions, environments, auth requirements, statuses, and MongoDB timestamps. Search and method/module/status filters work with paginated results. The initial records map to routes implemented in this project; the two `/api/demo/secure/*` records are explicitly labelled demonstrations.
- Consumer records store their allowed demo API IDs and methods, active/suspended/revoked status, and a per-minute request limit. The current API-key gateway is deliberately limited to those two demo endpoints; Campus Hub application APIs continue to require their existing signed-in session and role checks.
- API keys are generated with cryptographic randomness, stored only as SHA-256 hashes, and shown once on issue. Rotation and individual revocation invalidate prior keys. A suspended consumer receives `403`; missing/invalid/revoked credentials receive `401`, and a configured limit returns `429`.
- Each protected demo request is logged with timestamp, API ID, consumer ID when known, method, endpoint, HTTP status, duration, and success/failure outcome. The dashboard calculates totals, successes, failures, and success rate from those records.
- Admins can download an OpenAPI 3.0 JSON document with endpoint descriptions, path parameters, session/API-key schemes, request-body examples, and common response codes.

### API-management walkthrough (PowerShell)

1. Start MongoDB, run `npm run dev`, and sign in as the local administrator. Open **API Management → Consumers & keys** and create a consumer with one or both demo APIs, `GET`, and a low request limit (for example `1` per minute).
2. Select **Rotate / issue key** and copy the displayed key immediately. The database stores only its hash. Call an allowed endpoint:

   ```powershell
   $apiKey = "<paste-the-one-time-key>"
   Invoke-RestMethod http://localhost:4000/api/demo/secure/profile -Headers @{ "X-API-Key" = $apiKey }
   ```

3. Omit the header or provide an incorrect key to verify `401`. Permit only the modules demo API and request the profile demo API to verify `403`. Call an allowed endpoint again within the same minute to verify `429` and the `Retry-After` header.
4. Suspend the consumer and retry its valid key to verify `403`; reactivate it, revoke the key, then retry to verify `401`. Review the **Request logs** tab for the recorded outcomes and statistics.
5. In **API Management → API registry**, use search and the method/module/status filters; create, edit/archive, or delete an API record. Download **OpenAPI JSON** to review docs for the active registry entries.

The project does not claim that production APIs accept consumer API keys: key enforcement is only wired to the clearly labelled protected demo endpoints. Rate-limit counters are in memory for this single-process prototype and reset when the server restarts; use a shared store before deploying multiple server instances.

### One-time import from an existing MySQL database

The import copies MySQL `users` and `modules` records, including existing password hashes, into MongoDB. It does not delete or modify the MySQL source. The source account only needs read access:

```sql
CREATE USER IF NOT EXISTS 'zyngram_migrator'@'127.0.0.1'
  IDENTIFIED BY 'replace-with-a-strong-local-password';
GRANT SELECT ON zyngram_campus_hub.* TO 'zyngram_migrator'@'127.0.0.1';
```

Set `MYSQL_SOURCE_USER` and `MYSQL_SOURCE_PASSWORD` in the ignored `.env` file, then run:

```powershell
npm run migrate:mysql-to-mongodb
```

Records with matching IDs are updated from the MySQL source; missing records are added. If an existing MongoDB user has a conflicting ID/email, the import stops before writing records. Remove the `MYSQL_SOURCE_*` values from `.env` when the import is complete.

## Screenshots and demonstration

The `screenshots\` folder contains captures from the running local app and current verification:

- `01-login.png` — Zyngram sign-in and account choices.
- `02-trainee-modules.png` — trainee's read-only software-development module catalog.
- `03-admin-modules.png` — administrator module management for software topics.
- `04-trainee-dashboard.png` — learner dashboard with software courses and tasks.
- `05-crud-test-result.png` — browser verification of admin module create, edit, and delete.
- `06-trainee-profile.png` — separate profile page with editable learner details.
- `07-software-courses.png` — software course catalog; it now also includes AI, machine learning, full-stack web development, and data structures and algorithms.

Screenshots support the automated tests; demonstrate the live app locally as part of the submission.

## Known issues and scope

- This is a local MVP, not a production learning-management system. It has no email verification, email-based password recovery, persistent session store, backups, or production monitoring. Administrative audit records cover the supported account, role, course, announcement, and settings actions.
- New accounts can register as students; only an existing administrator can assign the administrator role from **Users & roles**. A valid email and password are not sufficient for administrator access unless that account has been assigned the role. Lesson, quiz, and study-note content is seeded for the current software catalog and can be extended as courses grow.
- Session cookies and login throttling are held in memory and reset when the Node.js server restarts; sign in again after a restart.
- Existing MySQL users and modules are not automatically imported into MongoDB. The MongoDB database is seeded independently on its first start.
- The built-in assistant is rule-based study guidance unless an OpenAI-compatible provider is configured. Group and course content is demonstration data; placement progress is self-reported by learners.
- Use fictional test data only. Never enter real learner, employee, or confidential information.
