import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import express from "express";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { courseIntroductions, courseModules } from "./course-curriculum.js";
import * as database from "./database.js";
import { careerPaths, mockInterviewQuestions, platformSeeds, roleAccounts } from "./platform-data.js";
import {
  initialManagedApis, managedApiEnvironments, managedApiMethods, toOpenApiPath,
  validateManagedApi, validateManagedConsumer
} from "./api-management.js";
import { isAllowedRequestOrigin, isZinEmail, isZinId, safeText, validatePassword, validateRegistration } from "./validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.CAMPUS_DATA_PATH || path.join(__dirname, "campus-data.json");
const PORT = Number(process.env.PORT || 4000);
const SESSION_TTL = 1000 * 60 * 60 * 8;
const SESSION_COOKIE = "zyngram_session";
const hashSessionToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const revokeUserSessions = async (userId) => {
  const collection = await database.getPlatformCollection("user_sessions");
  await collection.deleteMany({ userId });
};
const roleNamesForApi = {
  student: "Campus trainee",
  trainer: "Senior learning mentor",
  coordinator: "Campus coordinator",
  placement_officer: "Placement officer",
  administrator: "Hub administrator"
};
const app = express();
const loginAttempts = new Map();
const assistantRequests = new Map();
const apiRateWindows = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()"
  });
  next();
});

const makePassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString("hex")
});
const nameCode = (name) => {
  const firstName = name.normalize("NFKD").replace(/\p{Diacritic}/gu, "").split(/\s+/)[0]
    .replace(/[^a-z]/gi, "").toUpperCase() || "STUDENT";
  return `${firstName.slice(0, 2).padEnd(2, firstName[0])}${firstName.slice(-2).padStart(2, firstName.at(-1))}`;
};
const createZinId = (name) => {
  const letters = nameCode(name);
  const digits = Array.from({ length: 12 }, () => crypto.randomInt(0, 10)).join("");
  return `${letters.slice(0, 2)}${digits}${letters.slice(2)}`;
};
const isPersonalizedZinId = (name, zinId) => isZinId(zinId)
  && zinId.slice(0, 2) === nameCode(name).slice(0, 2)
  && zinId.slice(-2) === nameCode(name).slice(2);
const migrateLegacyZinIds = async () => {
  for (const user of data.users.filter((candidate) => candidate.role === "student"
    && isZinId(candidate.zinId) && !isPersonalizedZinId(candidate.zinName || candidate.name, candidate.zinId))) {
    const previousEmail = user.email.toLowerCase();
    let migrated = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const zinId = createZinId(user.name);
      const email = `${zinId.toLowerCase()}@zyngram.com`;
      if (await database.findUserByEmail(email)) continue;
      const loginAliases = [...new Set([...(user.loginAliases || []), previousEmail])];
      try {
        await database.updateUserProfile(user.id, { zinId, email, zinName: user.name, loginAliases });
        Object.assign(user, { zinId, email, zinName: user.name, loginAliases });
        migrated = true;
        break;
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    if (!migrated) throw new Error(`Unable to generate a personalized ZIN ID for ${user.id}.`);
  }
};
const publicUser = (user) => {
  const {
    salt, hash, loginAliases: _loginAliases, zinName: _zinName,
    avatarData, resumeData, ...profile
  } = user;
  return {
    ...profile,
    ...(user.role === "trainer" ? {
      trainerId: user.trainerId || `TRN-${user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`
    } : {}),
    ...(user.role === "coordinator" ? {
      coordinatorId: user.coordinatorId || `COO-${user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`
    } : {}),
    ...(user.role === "placement_officer" ? {
      placementOfficerId: user.placementOfficerId || `PO-${user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`
    } : {}),
    ...(avatarData ? { avatarUrl: "/api/profile/assets/avatar" } : {}),
    ...(resumeData ? { resumeFileName: resumeData.fileName } : {})
  };
};
const allowedRoles = (...roles) => (req, res, next) => (
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "You do not have permission to do that." })
);
const courseFor = (id) => data.courses.find((course) => course.id === id);
const trainerOwnsCourse = (course, trainer) => course?.trainerId === trainer.id
  || (!course?.trainerId && course?.trainer === trainer.name);
const trainerCourses = (trainer) => data.courses.filter((course) => trainerOwnsCourse(course, trainer));
const publicAnnouncement = ({ recipientIds: _recipientIds, ...announcement }) => announcement;
const courseAnnouncementVisible = (note, user) => note.recipientIds
  ? note.recipientIds.includes(user.id)
  : user.role !== "student"
    || !note.courseId && !note.batchId
    || Boolean(note.courseId && courseFor(note.courseId)?.enrolled.includes(user.id))
    || Boolean(note.batchId && note.recipientIds?.includes(user.id));
const courseModuleUnlocked = async (userId, courseId, module) => {
  if (module.order === 1) return true;
  const prerequisite = await database.getPlatformItem("course_modules", { courseId, order: module.order - 1 });
  if (!prerequisite) return false;
  return Boolean(await database.getPlatformItem("module_attempts", {
    userId,
    moduleId: prerequisite.id,
    passed: true
  }));
};
const isValidDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const findAssignmentSubmission = async (collection, id) => {
  const submission = await collection.findOne({ id });
  if (submission || !/^[a-f\d]{24}$/i.test(id)) return submission;
  return collection.findOne({ _id: new ObjectId(id) });
};
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const notifyUsers = async (userIds, title, detail, kind = "campus_update") => {
  const recipients = [...new Set(userIds.filter(Boolean))];
  await Promise.all(recipients.map((userId) => database.createPlatformItem("notifications", {
    id: crypto.randomUUID(), userId, kind, title, detail, read: false, date: new Date().toISOString()
  })));
};
const auditAdminAction = async (user, action, targetType, targetId, detail) => database.createPlatformItem("admin_audit_logs", {
  id: crypto.randomUUID(), actorId: user.id, actorName: user.name, action, targetType, targetId,
  detail: String(detail).slice(0, 300), outcome: "success", createdAt: new Date().toISOString()
});
const auditApiManagementAction = (user, action, targetType, targetId, detail) => auditAdminAction(
  user, action, targetType, targetId, detail
);
const issueConsumerKey = async (consumer, user) => {
  const key = `zhub_live_${crypto.randomBytes(32).toString("base64url")}`;
  const record = {
    id: crypto.randomUUID(),
    consumerId: consumer.id,
    keyHash: crypto.createHash("sha256").update(key).digest("hex"),
    keyPrefix: key.slice(0, 18),
    createdBy: user.id
  };
  await database.createPlatformItem("api_keys", record);
  return { id: record.id, key, keyPrefix: record.keyPrefix };
};
const recordApiUsage = (req, res, apiId, getConsumerId, startedAt) => {
  res.once("finish", () => {
    const statusCode = res.statusCode;
    database.createPlatformItem("api_usage_logs", {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      apiId,
      consumerId: getConsumerId(),
      method: req.method,
      endpoint: req.originalUrl.split("?")[0],
      statusCode,
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome: statusCode >= 400 ? "failure" : "success"
    }).catch((error) => console.error("Unable to record API management request activity.", error));
  });
};
const getAdminSettings = async () => await database.getPlatformItem("admin_settings", { id: "main" })
  || { sessionHours: SESSION_TTL / (60 * 60 * 1000), minimumPasswordLength: 8, applicationName: "Zyngram Campus Hub" };
const validateCampusPassword = async (password) => {
  const error = validatePassword(password);
  if (error) return error;
  const settings = await getAdminSettings();
  return password.length < settings.minimumPasswordLength
    ? `Password must be at least ${settings.minimumPasswordLength} characters.`
    : null;
};

const seedData = () => ({
  users: [
    { id: "u-student", name: "Aarav Mehta", email: "student@zyngram.demo", role: "student", title: "Software Development Trainee", initials: "AM", color: "lilac", ...makePassword("learn123") },
    { id: "u-trainer", name: "Mira Sharma", email: "trainer@zyngram.com", role: "trainer", title: "Senior learning mentor", initials: "MS", color: "peach", ...makePassword("teach123") },
    { id: "u-coordinator", name: "Devika Rao", email: "coordinator@zyngram.com", role: "coordinator", title: "Campus coordinator", initials: "DR", color: "mint", ...makePassword("campus123") },
    { id: "u-admin", name: "Kabir Nair", email: "admin@zyngram.com", role: "administrator", title: "Hub administrator", initials: "KN", color: "blue", ...makePassword("admin123") }
  ],
  courses: [
    { id: "c-1", title: "Frontend Development with React", category: "WEB DEVELOPMENT", description: "Build responsive interfaces with modern JavaScript, React components, hooks, and accessible UI patterns.", trainer: "Mira Sharma", schedule: "Mon · Wed · Fri, 10:00 AM", progress: 76, color: "purple", icon: "</>", enrolled: ["u-student"] },
    { id: "c-2", title: "Backend APIs with Node.js", category: "BACKEND", description: "Create secure REST APIs with Node.js, Express, authentication, validation, and practical testing.", trainer: "Mira Sharma", schedule: "Tue · Thu, 2:30 PM", progress: 48, color: "orange", icon: "{ }", enrolled: ["u-student"] },
    { id: "c-3", title: "SQL & Database Engineering", category: "DATABASES", description: "Write SQL queries, model application data, and connect relational and MongoDB databases to full-stack applications.", trainer: "Mira Sharma", schedule: "Friday, 4:00 PM", progress: 22, color: "green", icon: "SQL", enrolled: ["u-student"] },
    { id: "c-4", title: "Artificial Intelligence Fundamentals", category: "ARTIFICIAL INTELLIGENCE", description: "Explore AI concepts, search strategies, neural networks, responsible AI, and practical intelligent applications.", trainer: "Mira Sharma", schedule: "Mon · Wed, 11:30 AM", progress: 0, color: "purple", icon: "AI", enrolled: ["u-student"] },
    { id: "c-5", title: "Machine Learning Foundations", category: "MACHINE LEARNING", description: "Prepare data, train and evaluate machine-learning models, and build practical Python prediction projects.", trainer: "Mira Sharma", schedule: "Tue · Thu, 11:30 AM", progress: 0, color: "green", icon: "ML", enrolled: ["u-student"] },
    { id: "c-6", title: "Full-Stack Web Development", category: "WEB DEVELOPMENT", description: "Build and deploy responsive web applications with HTML, CSS, JavaScript, React, APIs, and databases.", trainer: "Mira Sharma", schedule: "Mon · Wed · Fri, 1:00 PM", progress: 0, color: "orange", icon: "WEB", enrolled: ["u-student"] },
    { id: "c-7", title: "Data Structures & Algorithms", category: "COMPUTER SCIENCE", description: "Strengthen problem-solving with arrays, trees, graphs, sorting, searching, and algorithm complexity.", trainer: "Mira Sharma", schedule: "Tue · Thu, 4:00 PM", progress: 0, color: "purple", icon: "DSA", enrolled: ["u-student"] },
    { id: "c-8", title: "Java Programming & OOP", category: "JAVA", description: "Learn Java syntax, object-oriented programming, collections, and problem solving by building small projects.", trainer: "Mira Sharma", schedule: "Tuesday · Thursday, 11:00 AM", progress: 0, color: "orange", icon: "J", enrolled: ["u-student"] },
    { id: "c-9", title: "Python for AI & Data Science", category: "PYTHON", description: "Build Python fundamentals, explore datasets, and prepare for practical machine-learning projects.", trainer: "Mira Sharma", schedule: "Wednesday, 2:00 PM", progress: 0, color: "green", icon: "Py", enrolled: ["u-student"] }
  ],
  tasks: [
    { id: "t-1", courseId: "c-1", title: "Build your first React component", detail: "Create a reusable, accessible React component and explain its props and state.", due: "2026-10-18", points: 100, status: "in progress", submissions: [] },
    { id: "t-2", courseId: "c-2", title: "Create a REST API endpoint", detail: "Build and test an Express endpoint with input validation and useful error responses.", due: "2026-10-20", points: 50, status: "not started", submissions: [] },
    { id: "t-3", courseId: "c-3", title: "Model a course database", detail: "Design a MongoDB collection for courses and describe how your application queries it.", due: "2026-10-14", points: 75, status: "submitted", submissions: [
      { id: "s-1", studentId: "u-student", text: "A quiet, helpful empty-state concept. The primary action is to explore the course library.", submittedAt: "2026-10-13T09:20:00.000Z", review: "submitted", feedback: "" }
    ] }
  ],
  attendance: [
    { id: "a-1", studentId: "u-student", courseId: "c-1", date: "2026-10-13", status: "present" },
    { id: "a-2", studentId: "u-student", courseId: "c-2", date: "2026-10-12", status: "present" },
    { id: "a-3", studentId: "u-student", courseId: "c-1", date: "2026-10-09", status: "late" },
    { id: "a-4", studentId: "u-student", courseId: "c-2", date: "2026-10-08", status: "present" },
    { id: "a-5", studentId: "u-student", courseId: "c-1", date: "2026-10-07", status: "present" }
  ],
  announcements: [
    { id: "n-1", title: "Design week is almost here ✨", body: "Five days of workshops, kind feedback, and making things together. Save your spot for the Friday showcase.", author: "Campus team", date: "2026-10-13", tag: "CAMPUS", color: "lavender" },
    { id: "n-2", title: "A little change to Thursday's session", body: "We'll meet in Studio B this week. Same time, new space — follow the blue signs from reception.", author: "Mira Sharma", date: "2026-10-12", tag: "YOUR COURSE", color: "peach" },
    { id: "n-3", title: "Your October learning check-in", body: "Take a moment to reflect on one thing you've learned and one thing you'd like to explore next.", author: "Campus team", date: "2026-10-10", tag: "WELLBEING", color: "mint" }
  ],
  support: []
});

const loadData = () => {
  if (!fs.existsSync(dataPath)) {
    const initial = seedData();
    fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2), { flag: "wx" });
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (error) {
    console.error(`Unable to read ${dataPath}:`, error);
    throw error;
  }
};
let data = loadData();
const persist = () => database.saveCampusData(data);
const getCookie = (req, name) => req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);

try {
  const seedUsers = [
    ...data.users,
    ...roleAccounts.map(({ password, ...user }) => ({ ...user, ...makePassword(password) }))
  ];
  await database.initializeDatabase(seedUsers);
  data.users = await database.getUsers();
  const savedCampusData = await database.getCampusData();
  if (savedCampusData) {
    const savedCourseIds = new Set((savedCampusData.courses || []).map((course) => course.id));
    data = {
      ...data,
      ...savedCampusData,
      courses: [...(savedCampusData.courses || []), ...data.courses.filter((course) => !savedCourseIds.has(course.id))],
      users: data.users
    };
    if (data.courses.length > (savedCampusData.courses || []).length) await database.saveCampusData(data);
  }
  else await database.saveCampusData(data);
  let courseOwnersUpdated = false;
  for (const course of data.courses) {
    if (!course.trainerId) {
      const owner = data.users.find((user) => user.role === "trainer" && user.name === course.trainer);
      if (owner) {
        course.trainerId = owner.id;
        courseOwnersUpdated = true;
      }
    }
  }
  if (courseOwnersUpdated) await database.saveCampusData(data);
  await migrateLegacyZinIds();
  await database.initializePlatformData({
    ...platformSeeds,
    course_modules: courseModules,
    api_registry: initialManagedApis
  });
} catch (error) {
  console.error("Unable to initialize MongoDB. Check the MongoDB service and MONGODB_* values in .env.", error);
  process.exit(1);
}

app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const host = req.get("host");
    if (!isAllowedRequestOrigin(origin, host, process.env.NODE_ENV === "production")) {
      return res.status(403).json({ error: "Request origin is not allowed." });
    }
  }
  next();
});

const apiKeyDemoGate = (apiId) => asyncRoute(async (req, res, next) => {
  const startedAt = Date.now();
  let consumerId = null;
  recordApiUsage(req, res, apiId, () => consumerId, startedAt);

  const bodyLength = Buffer.byteLength(JSON.stringify(req.body ?? null) || "", "utf8");
  if (bodyLength > 16 * 1024 || Number(req.get("content-length") || 0) > 16 * 1024) {
    return res.status(413).json({ error: "Request body must not exceed 16 KB." });
  }

  const authorization = req.get("authorization") || "";
  const suppliedKey = req.get("x-api-key")
    || (authorization.startsWith("ApiKey ") ? authorization.slice("ApiKey ".length).trim() : "");
  if (!suppliedKey || suppliedKey.length > 200) {
    return res.status(401).json({ error: "A valid API key is required." });
  }

  const keyHash = crypto.createHash("sha256").update(suppliedKey).digest("hex");
  const storedKey = await database.getPlatformItem("api_keys", { keyHash, revokedAt: { $exists: false } });
  if (!storedKey) return res.status(401).json({ error: "A valid API key is required." });

  const consumer = await database.getPlatformItem("api_consumers", { id: storedKey.consumerId });
  consumerId = storedKey.consumerId;
  if (!consumer || consumer.status !== "active") {
    return res.status(403).json({ error: "This API consumer is inactive or access has been revoked." });
  }

  const api = await database.getPlatformItem("api_registry", { id: apiId });
  if (!api || api.status !== "active"
    || api.method !== req.method
    || !consumer.allowedApiIds.includes(apiId)
    || !consumer.allowedMethods.includes(req.method)) {
    return res.status(403).json({ error: "This consumer is not permitted to use this endpoint and method." });
  }

  const now = Date.now();
  const minute = Math.floor(now / 60000) * 60000;
  const rateWindow = apiRateWindows.get(consumer.id);
  const currentWindow = rateWindow?.startedAt === minute
    ? rateWindow
    : { startedAt: minute, count: 0 };
  if (currentWindow.count >= consumer.rateLimit) {
    const retryAfter = Math.max(1, Math.ceil((minute + 60000 - now) / 1000));
    res.set({ "RateLimit-Limit": String(consumer.rateLimit), "Retry-After": String(retryAfter) });
    return res.status(429).json({ error: "Consumer rate limit exceeded. Try again after the current minute." });
  }

  currentWindow.count += 1;
  apiRateWindows.set(consumer.id, currentWindow);
  if (apiRateWindows.size > 10000) {
    for (const [id, window] of apiRateWindows) {
      if (window.startedAt + 60000 <= now) apiRateWindows.delete(id);
    }
  }
  res.set({
    "RateLimit-Limit": String(consumer.rateLimit),
    "RateLimit-Remaining": String(Math.max(0, consumer.rateLimit - currentWindow.count))
  });
  return next();
});

app.get("/api/demo/secure/profile", apiKeyDemoGate("api-demo-secure-profile"), (_req, res) => res.json({
  demo: true,
  profile: { displayName: "API Management Demo", access: "consumer-key protected" }
}));
app.get("/api/demo/secure/modules", apiKeyDemoGate("api-demo-secure-modules"), asyncRoute(async (_req, res) => {
  const modules = await database.getModules();
  return res.json({ demo: true, modules: modules.map(({ id, title, category }) => ({ id, title, category })) });
}));

const authenticateSession = asyncRoute(async (req, res, next) => {
  if (req.path === "/health" || req.path === "/auth/login" || req.path === "/auth/logout"
    || req.path.startsWith("/public/portfolio/")) return next();
  const token = getCookie(req, SESSION_COOKIE);
  const session = token ? await database.getPlatformItem("user_sessions", { tokenHash: hashSessionToken(token) }) : null;
  if (!session || session.expiresAt < new Date()) {
    if (session) await database.deletePlatformItem("user_sessions", { tokenHash: session.tokenHash });
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  const user = data.users.find((candidate) => candidate.id === session.userId);
  if (!user) return res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
  if (user.active === false) {
    await database.deletePlatformItem("user_sessions", { tokenHash: session.tokenHash });
    return res.status(403).json({ error: "This account is inactive. Contact your campus administrator." });
  }
  req.user = publicUser(user);
  if (user.mustChangePassword && req.path !== "/auth/me" && req.path !== "/auth/change-password") {
    return res.status(403).json({ error: "Choose a new password to continue.", code: "PASSWORD_SETUP_REQUIRED" });
  }
  return next();
});

app.get("/api/admin/apis", authenticateSession, allowedRoles("administrator"), asyncRoute(async (_req, res) => {
  return res.json(await database.getPlatformItems("api_registry", {}, { module: 1, name: 1 }));
}));
app.post("/api/admin/apis", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const validationError = validateManagedApi(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const api = {
    id: req.body.id.trim(),
    name: req.body.name.trim(),
    description: req.body.description.trim(),
    module: req.body.module.trim(),
    baseUrl: req.body.baseUrl.trim(),
    endpointPath: req.body.endpointPath.trim(),
    method: req.body.method.toUpperCase(),
    version: req.body.version.trim(),
    environment: req.body.environment,
    authRequired: req.body.authRequired,
    status: req.body.status
  };
  try {
    await database.createPlatformItem("api_registry", api);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An API already uses that identifier." });
    throw error;
  }
  await auditApiManagementAction(req.user, "created_api", "api", api.id, `${api.method} ${api.baseUrl}${api.endpointPath}`);
  return res.status(201).json(api);
}));
app.patch("/api/admin/apis/:apiId", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const current = await database.getPlatformItem("api_registry", { id: req.params.apiId });
  if (!current) return res.status(404).json({ error: "That API could not be found." });
  const candidate = { ...current, ...req.body, id: current.id };
  candidate.isMock = current.isMock;
  const validationError = validateManagedApi(candidate);
  if (validationError) return res.status(400).json({ error: validationError });
  const api = {
    ...candidate,
    name: candidate.name.trim(),
    description: candidate.description.trim(),
    module: candidate.module.trim(),
    baseUrl: candidate.baseUrl.trim(),
    endpointPath: candidate.endpointPath.trim(),
    method: candidate.method.toUpperCase(),
    version: candidate.version.trim()
  };
  delete api.createdAt;
  delete api.updatedAt;
  await database.updatePlatformItem("api_registry", { id: current.id }, api);
  await auditApiManagementAction(req.user, "updated_api", "api", api.id, `${api.method} ${api.baseUrl}${api.endpointPath}`);
  return res.json(api);
}));
app.delete("/api/admin/apis/:apiId", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const current = await database.getPlatformItem("api_registry", { id: req.params.apiId });
  if (!current) return res.status(404).json({ error: "That API could not be found." });
  const consumers = await database.getPlatformItems("api_consumers", { allowedApiIds: current.id });
  if (consumers.length) return res.status(409).json({ error: "Remove this API from its consumers before deleting it." });
  await database.deletePlatformItem("api_registry", { id: current.id });
  await auditApiManagementAction(req.user, "deleted_api", "api", current.id, current.name);
  return res.json({ ok: true });
}));
app.get("/api/admin/apis/openapi.json", authenticateSession, allowedRoles("administrator"), asyncRoute(async (_req, res) => {
  const apis = await database.getPlatformItems("api_registry", {}, { module: 1, name: 1 });
  const paths = {};
  const errorResponse = (description) => ({
    description,
    content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } }
  });
  for (const api of apis.filter((entry) => entry.status === "active")) {
    const url = new URL(`${api.baseUrl.replace(/\/+$/, "")}${api.endpointPath}`, "https://campus-hub.invalid");
    const endpoint = toOpenApiPath(url.pathname.replace(/^\/api/, "") || "/");
    const method = api.method.toLowerCase();
    paths[endpoint] ||= {};
    const pathParameters = [...api.endpointPath.matchAll(/:([A-Za-z0-9_]+)/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      description: `${name} identifier.`,
      schema: { type: "string" }
    }));
    paths[endpoint][method] = {
      operationId: api.id,
      summary: api.name,
      description: api.description,
      tags: [api.module],
      parameters: pathParameters,
      security: api.isMock
        ? [{ apiKey: [] }]
        : api.authRequired ? [{ campusSession: [] }] : [],
      ...(method === "get" ? {} : {
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: {}
            }
          }
        }
      }),
      responses: {
        "200": { description: "Request completed successfully.", content: { "application/json": { schema: { type: "object", additionalProperties: true }, example: { ok: true } } } },
        "201": { description: "Resource created." },
        "400": errorResponse("Invalid request data."),
        "401": errorResponse(api.isMock ? "API key is missing or invalid." : "A Campus Hub session is required."),
        "403": errorResponse("The account or consumer does not have permission for this operation."),
        "404": errorResponse("The requested resource was not found."),
        "409": errorResponse("The request conflicts with an existing resource or policy."),
        ...(api.isMock ? { "429": errorResponse("The consumer request limit was exceeded.") } : {}),
        "500": errorResponse("The server could not complete the request.")
      }
    };
  }
  return res.json({
    openapi: "3.0.3",
    info: { title: "Zyngram Campus Hub API", version: "v1" },
    servers: [{ url: "/api" }],
    paths,
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "X-API-Key", description: "Consumer keys are issued once in the API Management dashboard." },
        campusSession: { type: "apiKey", in: "cookie", name: SESSION_COOKIE, description: "Sign in to Campus Hub to establish a session." }
      }
    }
  });
}));
app.get("/api/admin/consumers", authenticateSession, allowedRoles("administrator"), asyncRoute(async (_req, res) => {
  const [consumers, keys] = await Promise.all([
    database.getPlatformItems("api_consumers", {}, { createdAt: -1 }),
    database.getPlatformItems("api_keys", {}, { createdAt: -1 })
  ]);
  return res.json(consumers.map((consumer) => ({
    ...consumer,
    keys: keys.filter((key) => key.consumerId === consumer.id)
      .map(({ id, keyPrefix, createdAt, revokedAt }) => ({ id, keyPrefix, createdAt, revokedAt }))
  })));
}));
app.post("/api/admin/consumers", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const apis = await database.getPlatformItems("api_registry");
  const validationError = validateManagedConsumer(
    req.body,
    new Set(apis.filter((api) => api.isMock).map((api) => api.id))
  );
  if (validationError) return res.status(400).json({ error: validationError });
  const consumer = {
    id: req.body.id.trim(),
    name: req.body.name.trim(),
    description: (req.body.description || "").trim(),
    allowedApiIds: [...new Set(req.body.allowedApiIds)],
    allowedMethods: [...new Set(req.body.allowedMethods.map((method) => method.toUpperCase()))],
    rateLimit: Number(req.body.rateLimit),
    status: req.body.status
  };
  try {
    await database.createPlatformItem("api_consumers", consumer);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "A consumer already uses that identifier." });
    throw error;
  }
  await auditApiManagementAction(req.user, "created_api_consumer", "api_consumer", consumer.id, consumer.name);
  return res.status(201).json(consumer);
}));
app.patch("/api/admin/consumers/:consumerId", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const current = await database.getPlatformItem("api_consumers", { id: req.params.consumerId });
  if (!current) return res.status(404).json({ error: "That API consumer could not be found." });
  const apis = await database.getPlatformItems("api_registry");
  const candidate = { ...current, ...req.body, id: current.id };
  const validationError = validateManagedConsumer(
    candidate,
    new Set(apis.filter((api) => api.isMock).map((api) => api.id))
  );
  if (validationError) return res.status(400).json({ error: validationError });
  const consumer = {
    ...candidate,
    name: candidate.name.trim(),
    description: candidate.description.trim(),
    allowedApiIds: [...new Set(candidate.allowedApiIds)],
    allowedMethods: [...new Set(candidate.allowedMethods.map((method) => method.toUpperCase()))],
    rateLimit: Number(candidate.rateLimit)
  };
  delete consumer.keys;
  delete consumer.createdAt;
  delete consumer.updatedAt;
  await database.updatePlatformItem("api_consumers", { id: current.id }, consumer);
  await auditApiManagementAction(req.user, "updated_api_consumer", "api_consumer", consumer.id, `${consumer.name}: ${consumer.status}`);
  return res.json(consumer);
}));
app.delete("/api/admin/consumers/:consumerId", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const consumer = await database.getPlatformItem("api_consumers", { id: req.params.consumerId });
  if (!consumer) return res.status(404).json({ error: "That API consumer could not be found." });
  const keys = await database.getPlatformItems("api_keys", { consumerId: consumer.id, revokedAt: { $exists: false } });
  await Promise.all(keys.map((key) => database.updatePlatformItem(
    "api_keys", { id: key.id }, { revokedAt: new Date().toISOString(), revokedBy: req.user.id }
  )));
  await database.deletePlatformItem("api_consumers", { id: consumer.id });
  await auditApiManagementAction(req.user, "deleted_api_consumer", "api_consumer", consumer.id, consumer.name);
  return res.json({ ok: true });
}));
app.post("/api/admin/consumers/:consumerId/keys", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const consumer = await database.getPlatformItem("api_consumers", { id: req.params.consumerId });
  if (!consumer) return res.status(404).json({ error: "That API consumer could not be found." });
  if (consumer.status !== "active") return res.status(409).json({ error: "Activate the consumer before issuing an API key." });
  const existingKeys = await database.getPlatformItems("api_keys", { consumerId: consumer.id, revokedAt: { $exists: false } });
  await Promise.all(existingKeys.map((key) => database.updatePlatformItem(
    "api_keys", { id: key.id }, { revokedAt: new Date().toISOString(), revokedBy: req.user.id }
  )));
  const issued = await issueConsumerKey(consumer, req.user);
  await auditApiManagementAction(req.user, "issued_api_key", "api_consumer", consumer.id, `Issued ${issued.keyPrefix}…`);
  return res.status(201).json(issued);
}));
app.delete("/api/admin/consumers/:consumerId/keys/:keyId", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const key = await database.getPlatformItem("api_keys", { id: req.params.keyId, consumerId: req.params.consumerId });
  if (!key) return res.status(404).json({ error: "That API key could not be found." });
  if (!key.revokedAt) await database.updatePlatformItem(
    "api_keys", { id: key.id }, { revokedAt: new Date().toISOString(), revokedBy: req.user.id }
  );
  await auditApiManagementAction(req.user, "revoked_api_key", "api_consumer", key.consumerId, `Revoked ${key.keyPrefix}…`);
  return res.json({ ok: true });
}));
app.get("/api/admin/api-usage", authenticateSession, allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const limitValue = Number(req.query.limit || 100);
  const limit = Number.isInteger(limitValue) ? Math.min(200, Math.max(1, limitValue)) : 100;
  const [logs, apis] = await Promise.all([
    database.getPlatformItems("api_usage_logs", {}, { createdAt: -1 }),
    database.getPlatformItems("api_registry")
  ]);
  const apiNames = new Map(apis.map((api) => [api.id, api.name]));
  const filtered = logs.filter((log) => (!req.query.apiId || log.apiId === req.query.apiId)
    && (!req.query.consumerId || log.consumerId === req.query.consumerId));
  return res.json({
    total: filtered.length,
    summary: {
      total: filtered.length,
      successful: filtered.filter((log) => log.outcome === "success").length,
      failed: filtered.filter((log) => log.outcome === "failure").length,
      successRate: filtered.length
        ? Math.round(filtered.filter((log) => log.outcome === "success").length / filtered.length * 100)
        : 0
    },
    entries: filtered.slice(0, limit).map((log) => ({
      ...log,
      apiName: apiNames.get(log.apiId) || log.apiId,
      timestamp: log.timestamp || log.createdAt
    }))
  });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const key = req.ip;
  const now = Date.now();
  const prior = loginAttempts.get(key);
  if (prior && now - prior.startedAt < 10 * 60 * 1000 && prior.count >= 10) {
    return res.status(429).json({ error: "Too many sign-in attempts. Please wait a few minutes and try again." });
  }
  if (!req.body || !safeText(req.body.email, 254) || !safeText(req.body.password, 128)
    || !["student", "trainer", "coordinator", "administrator", "placement_officer"].includes(req.body.role)) {
    return res.status(400).json({ error: "Choose an account type and enter a valid email address and password." });
  }
  const loginEmail = req.body.role === "student" && isZinId(req.body.email.trim())
      ? `${req.body.email.trim()}@zyngram.com`
      : req.body.email.trim();
  if (req.body.role === "student" && !isZinEmail(loginEmail)
    && !(process.env.NODE_ENV !== "production" && req.body.email.trim().toLowerCase() === "student@zyngram.demo")) {
    return res.status(401).json({ error: "Sign in with your personalized ZIN ID or its @zyngram.com email." });
  }
  const user = await database.findUserByEmail(loginEmail.toLowerCase());
  const supplied = crypto.scryptSync(req.body.password, user?.salt || "invalid-account-salt", 64);
  const expected = Buffer.from(user?.hash || "0".repeat(128), "hex");
  const valid = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  if (!valid) {
    loginAttempts.set(key, prior && now - prior.startedAt < 10 * 60 * 1000
      ? { ...prior, count: prior.count + 1 }
      : { startedAt: now, count: 1 });
    return res.status(401).json({ error: "That email and password combination wasn't recognised." });
  }
  if (user.role !== req.body.role) {
    return res.status(403).json({
      error: `This account is registered as ${roleNamesForApi[user.role]}. Sign in using that account type or ask an administrator to update the account role.`
    });
  }
  if (user.active === false) return res.status(403).json({ error: "This account is inactive. Contact your campus administrator." });
  loginAttempts.delete(key);
  const token = crypto.randomBytes(32).toString("hex");
  const settings = await getAdminSettings();
  const sessionTtl = settings.sessionHours * 60 * 60 * 1000;
  const tokenHash = hashSessionToken(token);
  const sessionExpiresAt = new Date(now + sessionTtl);
  await database.createPlatformItem("user_sessions", {
    id: tokenHash, tokenHash, userId: user.id, expiresAt: sessionExpiresAt
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: sessionTtl
  });
  return res.json({ user: publicUser(user) });
}));
app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { name, password, confirmPassword } = req.body || {};
  const validationError = validateRegistration({ name, password, confirmPassword });
  if (validationError) return res.status(400).json({ error: validationError });
  const campusPasswordError = await validateCampusPassword(password);
  if (campusPasswordError) return res.status(400).json({ error: campusPasswordError });
  const displayName = name.trim();
  let user;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const zinId = createZinId(displayName);
    const generatedEmail = `${zinId.toLowerCase()}@zyngram.com`;
    user = {
      id: crypto.randomUUID(),
      name: displayName,
      email: generatedEmail,
      zinId,
      zinName: displayName,
      role: "student",
      title: "Student",
      initials: displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      color: "lilac",
      ...makePassword(password)
    };
    try {
      await database.createUser(user);
      break;
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (attempt === 7) {
        return res.status(503).json({ error: "We could not generate a unique ZIN ID right now. Please try again." });
      }
    }
  }
  data.users.push(user);
  await persist();
  return res.status(201).json({ zinId: user.zinId, email: user.email });
}));

app.post("/api/auth/logout", asyncRoute(async (req, res) => {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) await database.deletePlatformItem("user_sessions", { tokenHash: hashSessionToken(token) });
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ ok: true });
}));

app.use("/api", authenticateSession);

app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
app.post("/api/auth/change-password", asyncRoute(async (req, res) => {
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  if (!user || user.role === "student" || !user.mustChangePassword) {
    return res.status(409).json({ error: "Password setup is not required for this account." });
  }
  const { password, confirmPassword } = req.body || {};
  const passwordError = await validateCampusPassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match." });
  if (crypto.scryptSync(password, user.salt, 64).equals(Buffer.from(user.hash, "hex"))) {
    return res.status(400).json({ error: "Choose a password different from your temporary password." });
  }
  const credentials = makePassword(password);
  if (!await database.updateUserProfile(user.id, {
    ...credentials, mustChangePassword: false
  })) return res.status(500).json({ error: "Your password could not be saved. Please try again." });
  Object.assign(user, credentials, { mustChangePassword: false });
  await persist();
  return res.json({ user: publicUser(user) });
}));
app.get("/api/profile/assets/:asset", (req, res) => {
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  const asset = req.params.asset === "avatar" ? user?.avatarData
    : req.params.asset === "resume" ? user?.resumeData
      : undefined;
  if (!asset) return res.status(req.params.asset === "avatar" || req.params.asset === "resume" ? 404 : 400)
    .json({ error: req.params.asset === "avatar" || req.params.asset === "resume" ? "That profile file was not found." : "Choose a supported profile file." });
  res.set({
    "Content-Type": asset.contentType,
    "Content-Disposition": `${req.params.asset === "resume" ? "attachment" : "inline"}; filename="${asset.fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  return res.send(Buffer.from(asset.data, "base64"));
});
app.post("/api/profile/assets/:asset", asyncRoute(async (req, res) => {
  const { asset: assetType } = req.params;
  if (!["avatar", "resume"].includes(assetType)) {
    return res.status(400).json({ error: "Choose a profile photo or PDF resume to upload." });
  }
  const { dataUrl, fileName } = req.body || {};
  if (typeof dataUrl !== "string" || typeof fileName !== "string") {
    return res.status(400).json({ error: "Choose a valid file to upload." });
  }
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return res.status(400).json({ error: assetType === "avatar" ? "Use a PNG, JPG or WebP profile photo." : "Upload your resume as a PDF." });
  const [, contentType, encoded] = match;
  const fileBuffer = Buffer.from(encoded, "base64");
  const limit = assetType === "avatar" ? 1.5 * 1024 * 1024 : 2 * 1024 * 1024;
  const validImage = contentType === "image/png" && fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || contentType === "image/jpeg" && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff
    || contentType === "image/webp" && fileBuffer.toString("ascii", 0, 4) === "RIFF" && fileBuffer.toString("ascii", 8, 12) === "WEBP";
  const validPdf = contentType === "application/pdf" && fileBuffer.toString("ascii", 0, 5) === "%PDF-";
  if (fileBuffer.length === 0 || fileBuffer.length > limit || (assetType === "avatar" ? !validImage : !validPdf)) {
    return res.status(400).json({
      error: assetType === "avatar"
        ? "Profile photos must be a valid PNG, JPG or WebP image no larger than 1.5 MB."
        : "Resumes must be a valid PDF no larger than 2 MB."
    });
  }
  const safeFileName = path.basename(fileName).replace(/[^\w.-]/g, "_").slice(0, 100)
    || (assetType === "avatar" ? "profile-photo" : "resume.pdf");
  const field = assetType === "avatar" ? "avatarData" : "resumeData";
  const storedAsset = { data: fileBuffer.toString("base64"), contentType, fileName: safeFileName, size: fileBuffer.length };
  if (!await database.updateUserProfile(req.user.id, { [field]: storedAsset })) {
    return res.status(404).json({ error: "Your profile could not be found." });
  }
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  Object.assign(user, { [field]: storedAsset });
  return res.json({ user: publicUser(user) });
}));
app.delete("/api/profile/assets/:asset", asyncRoute(async (req, res) => {
  if (!["avatar", "resume"].includes(req.params.asset)) {
    return res.status(400).json({ error: "Choose a supported profile file." });
  }
  const field = req.params.asset === "avatar" ? "avatarData" : "resumeData";
  if (!await database.updateUserProfile(req.user.id, { [field]: null })) {
    return res.status(404).json({ error: "Your profile could not be found." });
  }
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  delete user[field];
  return res.json({ user: publicUser(user) });
}));
app.get("/api/learners", allowedRoles("trainer", "coordinator", "administrator"), (req, res) => res.json(data.users
  .filter((user) => user.role === "student" && (req.user.role !== "trainer"
    || trainerCourses(req.user).some((course) => course.enrolled.includes(user.id))))
  .map((user) => ({ id: user.id, name: user.name, email: user.email }))));
app.get("/api/coordinator/students", allowedRoles("coordinator"), asyncRoute(async (_req, res) => {
  const batches = await database.getPlatformItems("batches");
  return res.json(data.users.filter((user) => user.role === "student").map((user) => ({
    id: user.id,
    zinId: user.zinId,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    bio: user.bio || "",
    skills: user.skills || "",
    courses: data.courses.filter((course) => course.enrolled.includes(user.id)).map((course) => course.title),
    enrollmentStatus: user.status || "active",
    batches: batches.filter((batch) => batch.learnerIds?.includes(user.id)).map((batch) => ({
      id: batch.id,
      name: batch.name,
      course: courseFor(batch.courseId)?.title || "Course"
    }))
  })));
}));
app.post("/api/attendance/mark", allowedRoles("trainer", "administrator"), asyncRoute(async (req, res) => {
  const { studentId, courseId, date, status } = req.body || {};
  const student = data.users.find((user) => user.id === studentId && user.role === "student");
  if (!student || !courseFor(courseId) || !courseFor(courseId).enrolled.includes(studentId)
    || (req.user.role === "trainer" && !trainerOwnsCourse(courseFor(courseId), req.user))
    || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !["present", "absent", "late"].includes(status)) {
    return res.status(400).json({ error: "Choose an enrolled student, course, valid date, and attendance status." });
  }
  const existing = data.attendance.find((entry) => entry.studentId === studentId && entry.courseId === courseId && entry.date === date);
  const record = existing
    ? Object.assign(existing, { status })
    : { id: crypto.randomUUID(), studentId, courseId, date, status };
  if (!existing) data.attendance.push(record);
  await persist();
  return res.json({ ...record, course: courseFor(courseId).title, student: student.name });
}));
app.get("/api/health", asyncRoute(async (_req, res) => {
  await database.checkConnection();
  res.json({ status: "ok", database: "connected" });
}));

app.get("/api/dashboard", asyncRoute(async (req, res) => {
  const visibleTasks = data.tasks.filter((task) => req.user.role === "student"
    ? courseFor(task.courseId)?.enrolled.includes(req.user.id)
    : req.user.role !== "trainer" || trainerOwnsCourse(courseFor(task.courseId), req.user));
  const tasks = visibleTasks.map((task) => ({
    ...task,
    course: courseFor(task.courseId)?.title || "Campus learning",
    submissions: task.submissions.filter((submission) => req.user.role !== "student" || submission.studentId === req.user.id)
  }));
  const records = data.attendance.filter((entry) => req.user.role === "student"
    ? entry.studentId === req.user.id
    : req.user.role !== "trainer" || trainerOwnsCourse(courseFor(entry.courseId), req.user));
  const [catalogLessons, progress, assignments, assignmentSubmissions, upcomingClasses, gamification, modules, moduleAttempts] = await Promise.all([
    database.getPlatformItems("lessons"),
    database.getPlatformItems("lesson_progress", { userId: req.user.id, completed: true }),
    database.getPlatformItems("assignments", req.user.role === "student"
      ? { courseId: { $in: data.courses.filter((course) => course.enrolled.includes(req.user.id)).map((course) => course.id) } }
      : req.user.role === "trainer" ? { trainerId: req.user.id } : {}),
    database.getPlatformItems("assignment_submissions", req.user.role === "student" ? { studentId: req.user.id } : {}),
    database.getPlatformItems("timetable", req.user.role === "trainer"
      ? { $or: [{ trainerId: req.user.id }, { courseId: { $in: trainerCourses(req.user).map((course) => course.id) } }] }
      : {}, { day: 1, startTime: 1 }),
    database.getPlatformItem("gamification", { userId: req.user.id }),
    database.getPlatformItems("course_modules"),
    database.getPlatformItems("module_attempts", { userId: req.user.id, passed: true })
  ]);
  const passedModuleIds = new Set(moduleAttempts.map((attempt) => attempt.moduleId));
  const courses = data.courses
    .filter((course) => req.user.role === "student" ? course.enrolled.includes(req.user.id)
      : req.user.role !== "trainer" || trainerOwnsCourse(course, req.user))
    .map((course) => {
      const courseLessons = catalogLessons.filter((lesson) => lesson.courseId === course.id);
      const done = progress.filter((lesson) => lesson.courseId === course.id).length;
      const courseModules = modules.filter((module) => module.courseId === course.id);
      const completedModules = courseModules.filter((module) => passedModuleIds.has(module.id)).length;
      const courseProgress = courseModules.length
        ? Math.round(completedModules / courseModules.length * 100)
        : courseLessons.length && done ? Math.round(done / courseLessons.length * 100) : course.progress;
      return { ...course, progress: courseProgress };
    });
  const upcomingWithDates = upcomingClasses.filter((item) => item.status !== "completed").map((item) => {
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(item.day);
    if (weekday < 0) return null;
    const now = new Date();
    const [hours, minutes] = item.startTime.split(":").map(Number);
    let daysUntil = (weekday - now.getDay() + 7) % 7;
    if (daysUntil === 0 && (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes()))) daysUntil = 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hours, minutes);
    return { ...item, course: courseFor(item.courseId)?.title || item.title, date: date.toISOString() };
  }).filter(Boolean).sort((left, right) => left.date.localeCompare(right.date));
  const openAssignments = req.user.role === "student" ? assignments.filter((assignment) =>
    !assignmentSubmissions.some((submission) => submission.assignmentId === assignment.id))
    .map((assignment) => ({
      id: assignment.id, title: assignment.title, due: assignment.due,
      course: courseFor(assignment.courseId)?.title || "Course assignment", status: "pending"
    })) : [];
  const upcomingTasks = [
    ...tasks.filter((task) => task.status !== "submitted" && isValidDate(task.due)),
    ...openAssignments.filter((assignment) => isValidDate(assignment.due))
  ].sort((left, right) => left.due.localeCompare(right.due));
  const weeklyActivity = Array.from({ length: 7 }, (_unused, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const day = date.toISOString().slice(0, 10);
    const lessonsDone = progress.filter((item) => String(item.completedAt || "").slice(0, 10) === day).length;
    const attendanceCount = records.filter((item) => item.date === day && item.status !== "absent").length;
    return { day: date.toLocaleDateString("en", { weekday: "short" }), count: lessonsDone + attendanceCount };
  });
  res.json({
    user: req.user,
    courses,
    tasks,
    announcements: data.announcements.filter((note) => courseAnnouncementVisible(note, req.user)).slice(0, 3).map(publicAnnouncement),
    attendancePercent: records.length ? Math.round(records.filter((item) => item.status !== "absent").length / records.length * 100) : 0,
    counts: {
      learners: req.user.role === "trainer"
        ? new Set(trainerCourses(req.user).flatMap((course) => course.enrolled)).size
        : data.users.filter((item) => item.role === "student").length,
      pendingReviews: data.tasks.filter((task) => req.user.role !== "trainer" || trainerOwnsCourse(courseFor(task.courseId), req.user))
        .flatMap((task) => task.submissions).filter((item) => item.review === "submitted").length
    },
    upcomingClasses: upcomingWithDates.slice(0, 4),
    nextClass: upcomingWithDates[0] || null,
    nextDeadline: upcomingTasks.find((task) => task.due >= new Date().toISOString().slice(0, 10)) || null,
    weeklyActivity,
    weeklyActiveDays: weeklyActivity.filter((item) => item.count > 0).length,
    nextAction: upcomingTasks[0]
      ? { kind: "assignment", title: `Continue ${upcomingTasks[0].title}`, detail: `${upcomingTasks[0].course} · due ${upcomingTasks[0].due}`, target: "tasks" }
      : courses.find((course) => course.progress < 100)
        ? { kind: "course", title: `Keep learning: ${courses.find((course) => course.progress < 100).title}`, detail: `${courses.find((course) => course.progress < 100).progress}% complete`, target: "courses" }
        : { kind: "explore", title: "Explore a new learning opportunity", detail: "Browse courses and placement recommendations.", target: "courses" },
    pendingAssignments: upcomingTasks.length,
    learningProgress: courses.length ? Math.round(courses.reduce((total, course) => total + course.progress, 0) / courses.length) : 0,
    learningPoints: gamification?.points || 0,
    badges: gamification?.badges || []
  });
}));
app.get("/api/trainer/overview", allowedRoles("trainer"), asyncRoute(async (req, res) => {
  const courses = trainerCourses(req.user);
  const courseIds = courses.map((course) => course.id);
  const batches = await database.getPlatformItems("batches", { trainerId: req.user.id }, { startDate: 1 });
  const learnerIds = new Set([
    ...courses.flatMap((course) => course.enrolled),
    ...batches.flatMap((batch) => batch.learnerIds || [])
  ]);
  const learners = data.users.filter((user) => user.role === "student" && learnerIds.has(user.id));
  const [timetable, assignments, submissions, lessonProgress, moduleAttempts] = await Promise.all([
    database.getPlatformItems("timetable", {
      $or: [{ trainerId: req.user.id }, { courseId: { $in: courseIds } }]
    }, { day: 1, startTime: 1 }),
    database.getPlatformItems("assignments", { $or: [{ trainerId: req.user.id }, { courseId: { $in: courseIds } }] }),
    database.getPlatformItems("assignment_submissions"),
    database.getPlatformItems("lesson_progress", { courseId: { $in: courseIds } }),
    database.getPlatformItems("module_attempts", { courseId: { $in: courseIds } })
  ]);
  const trainerAssignments = assignments.filter((item) => courseIds.includes(item.courseId));
  const pendingAssignments = new Set(submissions.filter((item) => trainerAssignments.some((assignment) => assignment.id === item.assignmentId)
    && item.status !== "reviewed").map((item) => item.id));
  const pendingTaskReviews = data.tasks.filter((task) => courseIds.includes(task.courseId))
    .flatMap((task) => task.submissions).filter((item) => item.review === "submitted").length;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const todayClasses = timetable.filter((item) => item.day === today && item.status !== "completed");
  const attendance = data.attendance.filter((item) => courseIds.includes(item.courseId));
  const students = learners.map((learner) => {
    const studentAttendance = attendance.filter((item) => item.studentId === learner.id);
    const studentAssignments = submissions.filter((item) => item.studentId === learner.id
      && trainerAssignments.some((assignment) => assignment.id === item.assignmentId));
    const studentCourses = courses.filter((course) => course.enrolled.includes(learner.id));
    const completedLessons = lessonProgress.filter((item) => item.userId === learner.id && item.completed).length;
    const passedModules = moduleAttempts.filter((item) => item.userId === learner.id && item.passed).length;
    return {
      id: learner.id,
      name: learner.name,
      email: learner.email,
      courses: studentCourses.map((course) => course.title),
      attendancePercent: studentAttendance.length
        ? Math.round(studentAttendance.filter((item) => item.status !== "absent").length / studentAttendance.length * 100)
        : 0,
      assignmentsSubmitted: studentAssignments.length,
      assignmentsReviewed: studentAssignments.filter((item) => item.status === "reviewed").length,
      marksAverage: studentAssignments.some((item) => item.status === "reviewed")
        ? Math.round(studentAssignments.filter((item) => item.status === "reviewed")
          .reduce((total, item) => total + item.marks / (trainerAssignments.find((assignment) => assignment.id === item.assignmentId)?.points || 1), 0)
          / studentAssignments.filter((item) => item.status === "reviewed").length * 100)
        : null,
      completedLessons,
      passedModules,
      skills: learner.skills || ""
    };
  });
  return res.json({
    trainerId: req.user.trainerId,
    students,
    batches: batches.map((batch) => ({
      ...batch,
      course: courseFor(batch.courseId)?.title || "Course",
      learnerCount: batch.learnerIds?.length || 0
    })),
    todayClasses: todayClasses.map((item) => ({ ...item, course: courseFor(item.courseId)?.title || item.title })),
    pendingEvaluations: pendingAssignments.size + pendingTaskReviews,
    attendancePercent: attendance.length
      ? Math.round(attendance.filter((item) => item.status !== "absent").length / attendance.length * 100)
      : 0,
    announcements: data.announcements.filter((note) => !note.courseId || courseIds.includes(note.courseId)).slice(0, 5).map(publicAnnouncement),
    courses
  });
}));

app.get("/api/coordinator/overview", allowedRoles("coordinator"), asyncRoute(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const [batches, classes, events, assignments, submissions] = await Promise.all([
    database.getPlatformItems("batches", {}, { startDate: 1 }),
    database.getPlatformItems("timetable", {}, { day: 1, startTime: 1 }),
    database.getPlatformItems("events", { date: { $gte: today } }, { date: 1, startTime: 1 }),
    database.getPlatformItems("assignments"),
    database.getPlatformItems("assignment_submissions")
  ]);
  const students = data.users.filter((user) => user.role === "student");
  const trainers = data.users.filter((user) => user.role === "trainer");
  const attendance = data.attendance;
  const lowAttendance = students.map((student) => {
    const records = attendance.filter((entry) => entry.studentId === student.id);
    const percent = records.length ? Math.round(records.filter((entry) => entry.status !== "absent").length / records.length * 100) : null;
    return percent !== null && percent < 75 ? { id: student.id, name: student.name, percent } : null;
  }).filter(Boolean);
  const pendingReviews = submissions.filter((submission) => submission.status !== "reviewed").length
    + data.tasks.flatMap((task) => task.submissions).filter((submission) => submission.review === "submitted").length;
  const outstandingAssignments = assignments.reduce((total, assignment) => {
    const enrolled = courseFor(assignment.courseId)?.enrolled || [];
    const reviewedIds = new Set(submissions.filter((submission) => submission.assignmentId === assignment.id && submission.status === "reviewed")
      .map((submission) => submission.studentId));
    return total + enrolled.filter((studentId) => !reviewedIds.has(studentId)).length;
  }, 0);
  const outstandingTasks = data.tasks.reduce((total, task) => {
    const enrolled = courseFor(task.courseId)?.enrolled || [];
    const reviewedIds = new Set(task.submissions.filter((submission) => submission.review === "reviewed")
      .map((submission) => submission.studentId));
    return total + enrolled.filter((studentId) => !reviewedIds.has(studentId)).length;
  }, 0);
  const requests = data.support.filter((ticket) => ticket.status !== "resolved");
  const activeBatches = batches.filter((batch) => batch.status === "active"
    || (!batch.status && batch.startDate <= today && (!batch.endDate || batch.endDate >= today)));
  const todayClasses = classes.filter((item) => item.day === weekday && item.status !== "completed");
  const missingAttendance = todayClasses.filter((item) => !attendance.some((entry) => entry.courseId === item.courseId && entry.date === today));
  return res.json({
    counts: {
      students: students.length,
      trainers: trainers.length,
      activeBatches: activeBatches.length,
      todayClasses: todayClasses.length,
      pendingRequests: requests.length,
      pendingAssignments: outstandingAssignments + outstandingTasks
    },
    attendancePercent: attendance.length
      ? Math.round(attendance.filter((entry) => entry.status !== "absent").length / attendance.length * 100)
      : 0,
    lowAttendance,
    missingAttendance: missingAttendance.map((item) => ({
      id: item.id,
      title: item.title,
      trainer: item.trainer,
      room: item.room
    })),
    todayClasses: todayClasses.map((item) => ({ ...item, course: courseFor(item.courseId)?.title || item.title })),
    upcomingEvents: events.slice(0, 5),
    pendingRequests: requests.slice(0, 5).map((ticket) => ({
      ...ticket,
      user: data.users.find((user) => user.id === ticket.userId)?.name || "Campus member"
    })),
    batches: batches.map((batch) => ({
      ...batch,
      course: courseFor(batch.courseId)?.title || "Course",
      trainer: trainers.find((trainer) => trainer.id === batch.trainerId)?.name || "Trainer",
      learnerCount: batch.learnerIds?.length || 0,
      status: batch.status || (batch.startDate > today ? "upcoming" : batch.endDate && batch.endDate < today ? "completed" : "active")
    })),
    pendingReviews
  });
}));

app.get("/api/courses", asyncRoute(async (req, res) => {
  const [lessons, progress, modules, moduleAttempts] = await Promise.all([
    database.getPlatformItems("lessons"),
    database.getPlatformItems("lesson_progress", { userId: req.user.id, completed: true }),
    database.getPlatformItems("course_modules"),
    database.getPlatformItems("module_attempts", { userId: req.user.id, passed: true })
  ]);
  const passedModuleIds = new Set(moduleAttempts.map((attempt) => attempt.moduleId));
  const visibleCourses = req.user.role === "trainer" ? trainerCourses(req.user)
    : req.user.role === "administrator" ? data.courses
      : data.courses.filter((course) => course.status !== "archived");
  return res.json(visibleCourses.map((course) => {
    const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
    const courseModules = modules.filter((module) => module.courseId === course.id);
    const completedModules = courseModules.filter((module) => passedModuleIds.has(module.id)).length;
    return {
      ...course,
      enrolled: course.enrolled.includes(req.user.id),
      progress: courseModules.length
        ? Math.round(completedModules / courseModules.length * 100)
        : courseLessons.length && progress.some((lesson) => lesson.courseId === course.id)
          ? Math.round(progress.filter((lesson) => lesson.courseId === course.id).length / courseLessons.length * 100)
          : course.progress
    };
  }));
}));
app.post("/api/courses", allowedRoles("trainer"), asyncRoute(async (req, res) => {
  const { title, category, description, schedule } = req.body || {};
  if (!safeText(title, 120) || !safeText(category, 60) || !safeText(description, 1000)
    || (schedule !== undefined && (typeof schedule !== "string" || schedule.trim().length > 120))) {
    return res.status(400).json({ error: "Enter a course title, category, description, and optional schedule." });
  }
  const normalizedTitle = title.trim();
  if (data.courses.some((course) => course.title.toLowerCase() === normalizedTitle.toLowerCase())) {
    return res.status(409).json({ error: "A course with that title already exists." });
  }
  const course = {
    id: `course-${crypto.randomUUID()}`,
    title: normalizedTitle,
    category: category.trim().toUpperCase(),
    description: description.trim(),
    trainer: req.user.name,
    trainerId: req.user.id,
    schedule: schedule?.trim() || "Schedule to be announced",
    progress: 0,
    color: "green",
    icon: "COURSE",
    enrolled: []
  };
  data.courses.push(course);
  await persist();
  return res.status(201).json({ ...course, enrolled: false });
}));
app.post("/api/admin/courses", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const { title, category, description, schedule = "", trainerId = "" } = req.body || {};
  const trainer = trainerId ? data.users.find((user) => user.id === trainerId && user.role === "trainer") : null;
  if (!safeText(title, 120) || !safeText(category, 60) || !safeText(description, 1000)
    || typeof schedule !== "string" || schedule.trim().length > 120
    || (trainerId && !trainer)) {
    return res.status(400).json({ error: "Provide a title, category, description, optional schedule, and valid trainer." });
  }
  const normalizedTitle = title.trim();
  if (data.courses.some((course) => course.title.toLowerCase() === normalizedTitle.toLowerCase())) {
    return res.status(409).json({ error: "A course with that title already exists." });
  }
  const course = {
    id: `course-${crypto.randomUUID()}`, title: normalizedTitle, category: category.trim().toUpperCase(),
    description: description.trim(), trainer: trainer?.name || "Unassigned",
    ...(trainer ? { trainerId: trainer.id } : {}),
    schedule: schedule.trim() || "Schedule to be announced",
    progress: 0, color: "green", icon: "COURSE", enrolled: [], status: "active"
  };
  data.courses.push(course);
  await persist();
  await auditAdminAction(req.user, "created_course", "course", course.id, course.title);
  return res.status(201).json(course);
}));
app.patch("/api/admin/courses/:courseId", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const course = courseFor(req.params.courseId);
  if (!course) return res.status(404).json({ error: "That course could not be found." });
  const { title, category, description, schedule = "", trainerId = "", status = "active" } = req.body || {};
  const trainer = trainerId ? data.users.find((user) => user.id === trainerId && user.role === "trainer") : null;
  if (!safeText(title, 120) || !safeText(category, 60) || !safeText(description, 1000)
    || typeof schedule !== "string" || schedule.trim().length > 120
    || (trainerId && !trainer) || !["active", "archived"].includes(status)) {
    return res.status(400).json({ error: "Provide valid course details, trainer assignment, and active or archived status." });
  }
  if (data.courses.some((item) => item.id !== course.id && item.title.toLowerCase() === title.trim().toLowerCase())) {
    return res.status(409).json({ error: "A course with that title already exists." });
  }
  Object.assign(course, {
    title: title.trim(), category: category.trim().toUpperCase(), description: description.trim(),
    schedule: schedule.trim() || "Schedule to be announced",
    trainer: trainer?.name || "Unassigned", trainerId: trainer?.id || "", status
  });
  await persist();
  await auditAdminAction(req.user, status === "archived" ? "archived_course" : "updated_course", "course", course.id, course.title);
  return res.json(course);
}));
app.post("/api/courses/:courseId/enroll", allowedRoles("student"), asyncRoute(async (req, res) => {
  const course = courseFor(req.params.courseId);
  if (!course) return res.status(404).json({ error: "That course could not be found." });
  if (!course.enrolled.includes(req.user.id)) {
    course.enrolled.push(req.user.id);
    await persist();
  }
  return res.json({ course: { ...course, enrolled: true } });
}));
app.get("/api/learning-content", asyncRoute(async (req, res) => {
  const [lessons, resources, quizzes, progress, attempts, modules, moduleAttempts, topicProgress] = await Promise.all([
    database.getPlatformItems("lessons", {}, { courseId: 1, order: 1 }),
    database.getPlatformItems("resources", {}, { courseId: 1, title: 1 }),
    database.getPlatformItems("quizzes", {}, { courseId: 1 }),
    database.getPlatformItems("lesson_progress", { userId: req.user.id }),
    database.getPlatformItems("quiz_attempts", { userId: req.user.id }),
    database.getPlatformItems("course_modules", {}, { courseId: 1, order: 1 }),
    database.getPlatformItems("module_attempts", { userId: req.user.id }, { createdAt: -1 }),
    database.getPlatformItems("topic_progress", { userId: req.user.id })
  ]);
  const completed = new Set(progress.filter((item) => item.completed).map((item) => item.lessonId));
  const latestAttempts = new Map();
  for (const attempt of attempts) {
    if (!latestAttempts.has(attempt.quizId)) latestAttempts.set(attempt.quizId, attempt);
  }
  const latestModuleAttempts = new Map();
  const passedModules = new Set();
  const completedTopics = new Set(topicProgress.filter((item) => item.completed).map((item) => item.topicId));
  for (const attempt of moduleAttempts) {
    if (attempt.passed) passedModules.add(attempt.moduleId);
    if (!latestModuleAttempts.has(attempt.moduleId)) latestModuleAttempts.set(attempt.moduleId, attempt);
  }
  return res.json({
    courseIntroductions,
    lessons: lessons.map((lesson) => ({ ...lesson, completed: completed.has(lesson.id) })),
    resources: resources.map(({ content: _content, fileData: _fileData, ...resource }) => resource),
    modules: modules.map((module) => {
      const previous = modules.find((item) => item.courseId === module.courseId && item.order === module.order - 1);
      const latestAttempt = latestModuleAttempts.get(module.id) || null;
      return {
        ...module,
        topics: module.topics.map((topic) => ({ ...topic, completed: completedTopics.has(topic.id) })),
        assignment: {
          title: module.assignment.title,
          questions: module.assignment.questions.map(({ answer: _answer, ...item }) => item)
        },
        unlocked: req.user.role !== "student" || module.order === 1 || Boolean(previous && passedModules.has(previous.id)),
        passed: passedModules.has(module.id),
        latestAttempt
      };
    }),
    quizzes: quizzes.map((quiz) => ({
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      questions: quiz.questions.map(({ answer: _answer, ...question }) => question),
      latestAttempt: latestAttempts.get(quiz.id) || null
    }))
  });
}));
app.post("/api/lessons/:lessonId/complete", allowedRoles("student"), asyncRoute(async (req, res) => {
  const lesson = await database.getPlatformItem("lessons", { _id: req.params.lessonId });
  if (!lesson) return res.status(404).json({ error: "That lesson could not be found." });
  const course = courseFor(lesson.courseId);
  if (!course?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course before updating lesson progress." });
  if (lesson.moduleId) {
    const module = await database.getPlatformItem("course_modules", { _id: lesson.moduleId });
    if (!module || !await courseModuleUnlocked(req.user.id, lesson.courseId, module)) {
      return res.status(409).json({ error: "Pass the previous module assignment to unlock this lesson." });
    }
  }
  const collection = await database.getPlatformCollection("lesson_progress");
  const previous = await collection.findOne({ userId: req.user.id, lessonId: lesson.id });
  if (!previous?.completed) {
    await collection.updateOne(
      { userId: req.user.id, lessonId: lesson.id },
      { $set: { userId: req.user.id, lessonId: lesson.id, courseId: lesson.courseId, completed: true, completedAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    await database.incrementGamification(req.user.id, 10, "Curious learner");
  }
  const completedCount = await collection.countDocuments({ userId: req.user.id, courseId: lesson.courseId, completed: true });
  return res.json({ completed: true, courseProgress: Math.round(completedCount / (await database.getPlatformCollection("lessons")).countDocuments({ courseId: lesson.courseId }) * 100) });
}));
app.post("/api/course-topics/:topicId/complete", allowedRoles("student"), asyncRoute(async (req, res) => {
  const module = await database.getPlatformItem("course_modules", { "topics.id": req.params.topicId });
  if (!module) return res.status(404).json({ error: "That course topic could not be found." });
  const course = courseFor(module.courseId);
  if (!course?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course before completing its topics." });
  if (!await courseModuleUnlocked(req.user.id, module.courseId, module)) {
    return res.status(409).json({ error: "Pass the previous module assignment to unlock this topic." });
  }
  const topic = module.topics.find((item) => item.id === req.params.topicId);
  const topics = await database.getPlatformCollection("topic_progress");
  await topics.updateOne(
    { userId: req.user.id, topicId: topic.id },
    { $set: { userId: req.user.id, courseId: module.courseId, moduleId: module.id, topicId: topic.id, completed: true, completedAt: new Date(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  const completedCount = await topics.countDocuments({ userId: req.user.id, moduleId: module.id, completed: true });
  return res.json({ topicId: topic.id, completed: true, completedCount, totalTopics: module.topics.length, assignmentUnlocked: completedCount === module.topics.length });
}));
app.get("/api/resources/:resourceId/download", asyncRoute(async (req, res) => {
  const resource = await database.getPlatformItem("resources", { _id: req.params.resourceId });
  if (!resource) return res.status(404).json({ error: "That course resource could not be found." });
  const course = courseFor(resource.courseId);
  if (req.user.role === "student" && !course?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course to access its notes." });
  if (req.user.role === "trainer" && !trainerOwnsCourse(course, req.user)) return res.status(403).json({ error: "You can only access materials for your assigned courses." });
  if (resource.url) return res.redirect(resource.url);
  const filename = (resource.fileName || `${resource.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.txt`).replace(/[\\/:*?"<>|]/g, "_");
  const contentType = resource.contentType || "text/plain; charset=utf-8";
  const content = resource.fileData ? Buffer.from(resource.fileData, "base64") : resource.content || "";
  res.set({ "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` });
  return res.send(content);
}));
app.post("/api/resources", allowedRoles("trainer"), asyncRoute(async (req, res) => {
  const { courseId, title, type, content, url, file } = req.body || {};
  const course = courseFor(courseId);
  if (!course || !trainerOwnsCourse(course, req.user) || !safeText(title, 120)
    || !["notes", "link", "pdf"].includes(type)) {
    return res.status(400).json({ error: "Choose one of your courses, a resource title, and a valid resource type." });
  }
  let resource = {
    id: crypto.randomUUID(),
    courseId,
    title: title.trim(),
    createdBy: req.user.id
  };
  if (type === "notes") {
    if (!safeText(content, 10000)) return res.status(400).json({ error: "Add course notes (up to 10,000 characters)." });
    resource = { ...resource, content: content.trim(), contentType: "text/plain; charset=utf-8" };
  } else if (type === "link") {
    let destination;
    try { destination = new URL(url); } catch { return res.status(400).json({ error: "Enter a valid HTTPS learning resource link." }); }
    if (destination.protocol !== "https:") return res.status(400).json({ error: "Learning resource links must use HTTPS." });
    resource = { ...resource, url: destination.toString() };
  } else {
    if (!file || !safeText(file.name, 120) || file.type !== "application/pdf"
      || typeof file.data !== "string" || !/^data:application\/pdf;base64,[a-z0-9+/=]+$/i.test(file.data)) {
      return res.status(400).json({ error: "Choose a valid PDF file." });
    }
    const bytes = Buffer.from(file.data.slice(file.data.indexOf(",") + 1), "base64");
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return res.status(413).json({ error: "PDF resources must be smaller than 2 MB." });
    resource = {
      ...resource,
      fileName: file.name.replace(/[\\/:*?"<>|]/g, "_"),
      fileData: bytes.toString("base64"),
      contentType: "application/pdf"
    };
  }
  await database.createPlatformItem("resources", resource);
  const { content: _content, fileData: _fileData, ...safeResource } = resource;
  return res.status(201).json(safeResource);
}));
app.post("/api/quizzes/:quizId/attempts", allowedRoles("student"), asyncRoute(async (req, res) => {
  const quiz = await database.getPlatformItem("quizzes", { _id: req.params.quizId });
  if (!quiz) return res.status(404).json({ error: "That quiz could not be found." });
  const course = courseFor(quiz.courseId);
  if (!course?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course before taking its quiz." });
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length
    || answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= quiz.questions[index].options.length)) {
    return res.status(400).json({ error: "Choose one answer for each quiz question." });
  }
  const score = answers.reduce((total, answer, index) => total + Number(answer === quiz.questions[index].answer), 0);
  const attempt = { id: crypto.randomUUID(), userId: req.user.id, quizId: quiz.id, courseId: quiz.courseId, score, total: quiz.questions.length, percentage: Math.round(score / quiz.questions.length * 100) };
  await database.createPlatformItem("quiz_attempts", attempt);
  if (score) await database.incrementGamification(req.user.id, score * 5, attempt.percentage === 100 ? "Quiz ace" : undefined);
  return res.status(201).json(attempt);
}));
app.post("/api/course-modules/:moduleId/attempts", allowedRoles("student"), asyncRoute(async (req, res) => {
  const module = await database.getPlatformItem("course_modules", { _id: req.params.moduleId });
  if (!module) return res.status(404).json({ error: "That course module could not be found." });
  const course = courseFor(module.courseId);
  if (!course?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course before completing its assignments." });
  if (!await courseModuleUnlocked(req.user.id, module.courseId, module)) {
    return res.status(409).json({ error: "Pass the previous module assignment before starting this one." });
  }
  const attempts = await database.getPlatformCollection("module_attempts");
  if (await attempts.findOne({ userId: req.user.id, moduleId: module.id, passed: true })) {
    return res.status(409).json({ error: "You have already passed this module assignment." });
  }
  const completedTopicCount = await (await database.getPlatformCollection("topic_progress"))
    .countDocuments({ userId: req.user.id, moduleId: module.id, completed: true });
  if (completedTopicCount !== module.topics.length) {
    return res.status(409).json({ error: "Complete every topic in this module before starting its assignment." });
  }
  const answers = req.body?.answers;
  const questions = module.assignment.questions;
  if (!Array.isArray(answers) || answers.length !== questions.length
    || answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= questions[index].options.length)) {
    return res.status(400).json({ error: "Choose one answer for each module assignment question." });
  }
  const score = answers.reduce((total, answer, index) => total + Number(answer === questions[index].answer), 0);
  const percentage = Math.round(score / questions.length * 100);
  const attempt = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    moduleId: module.id,
    courseId: module.courseId,
    score,
    total: questions.length,
    percentage,
    passed: score / questions.length * 100 >= 70
  };
  await database.createPlatformItem("module_attempts", attempt);
  return res.status(201).json({ ...attempt, passPercentage: 70 });
}));
app.get("/api/certificates", allowedRoles("student"), asyncRoute(async (req, res) => {
  const [lessons, progress, modules, passedAttempts] = await Promise.all([
    database.getPlatformItems("lessons"),
    database.getPlatformItems("lesson_progress", { userId: req.user.id, completed: true }),
    database.getPlatformItems("course_modules"),
    database.getPlatformItems("module_attempts", { userId: req.user.id, passed: true })
  ]);
  const completed = new Set(progress.map((item) => item.lessonId));
  const passedModuleIds = new Set(passedAttempts.map((item) => item.moduleId));
  const courses = new Map();
  for (const lesson of lessons) {
    const record = courses.get(lesson.courseId) || { total: 0, completed: 0 };
    record.total += 1;
    if (completed.has(lesson.id)) record.completed += 1;
    courses.set(lesson.courseId, record);
  }
  return res.json(data.courses.filter((course) => course.enrolled.includes(req.user.id)).map((course) => {
    const lessonProgress = courses.get(course.id) || { total: 0, completed: 0 };
    const courseModules = modules.filter((module) => module.courseId === course.id);
    const passedCount = courseModules.filter((module) => passedModuleIds.has(module.id)).length;
    const eligible = lessonProgress.total > 0
      && lessonProgress.completed === lessonProgress.total
      && courseModules.length > 0
      && passedCount === courseModules.length;
    if (!eligible) {
      return {
        courseId: course.id,
        course: course.title,
        learner: req.user.name,
        eligible: false,
        completedLessons: lessonProgress.completed,
        totalLessons: lessonProgress.total,
        passedModules: passedCount,
        totalModules: courseModules.length
      };
    }
    const completionDates = [
      ...progress.filter((item) => item.courseId === course.id).map((item) => new Date(item.completedAt)),
      ...passedAttempts.filter((attempt) => attempt.courseId === course.id).map((attempt) => new Date(attempt.createdAt))
    ];
    const completedAt = completionDates.reduce((latest, value) => value > latest ? value : latest, new Date(0));
    const certificateId = crypto.createHash("sha256").update(`${req.user.id}:${course.id}:${completedAt.toISOString()}`).digest("hex").slice(0, 16).toUpperCase();
    return {
      courseId: course.id,
      course: course.title,
      learner: req.user.name,
      eligible: true,
      completedLessons: lessonProgress.completed,
      totalLessons: lessonProgress.total,
      passedModules: passedCount,
      totalModules: courseModules.length,
      issuedAt: completedAt.toISOString(),
      certificateId
    };
  }));
}));
app.get("/api/certificates/:courseId/pdf", allowedRoles("student"), asyncRoute(async (req, res) => {
  const course = courseFor(req.params.courseId);
  if (!course || !course.enrolled.includes(req.user.id)) return res.status(404).json({ error: "That course certificate is not available for your account." });
  const [lessons, progress, modules, passedAttempts] = await Promise.all([
    database.getPlatformItems("lessons", { courseId: course.id }),
    database.getPlatformItems("lesson_progress", { userId: req.user.id, courseId: course.id, completed: true }),
    database.getPlatformItems("course_modules", { courseId: course.id }),
    database.getPlatformItems("module_attempts", { userId: req.user.id, courseId: course.id, passed: true })
  ]);
  if (!lessons.length || !modules.length
    || lessons.some((lesson) => !progress.some((item) => item.lessonId === lesson.id))
    || modules.some((module) => !passedAttempts.some((attempt) => attempt.moduleId === module.id))) {
    return res.status(409).json({ error: "Pass every module assignment and complete every lesson before downloading this certificate." });
  }
  const completionDates = [
    ...progress.map((item) => new Date(item.completedAt)),
    ...passedAttempts.map((attempt) => new Date(attempt.createdAt))
  ];
  const completedAt = completionDates.reduce((latest, value) => value > latest ? value : latest, new Date(0));
  const certificateId = crypto.createHash("sha256").update(`${req.user.id}:${course.id}:${completedAt.toISOString()}`).digest("hex").slice(0, 16).toUpperCase();
  const doc = new PDFDocument({ size: "A4", layout: "landscape", compress: false, margins: 0, info: { Title: `Course Completion Certificate - ${course.title}`, Author: "Zyngram Campus Hub", Subject: `${course.title} completion certificate awarded to ${req.user.name} · Certificate ${certificateId} · Presented by Kasarla Jagan Kumar, CEO & Founder`, Keywords: `Zyngram completion verified seal CERTIFICATE OF COURSE COMPLETION ${certificateId} ${req.user.name} ${course.title} Kasarla Jagan Kumar CEO Founder` } });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="zyngram-certificate-${course.id}.pdf"`,
    "Cache-Control": "private, no-store"
  });
  doc.pipe(res);
  const navy = "#19324a";
  const gold = "#c89c35";
  const muted = "#617286";
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const center = pageWidth / 2;
  const contentWidth = pageWidth - 100;
  const awardedOn = completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.rect(0, 0, pageWidth, pageHeight).fill("#f8f6ef");
  doc.rect(16, 16, pageWidth - 32, pageHeight - 32).lineWidth(2.5).stroke(navy);
  doc.rect(28, 28, pageWidth - 56, pageHeight - 56).lineWidth(1).stroke(gold);
  doc.image(path.join(__dirname, "..", "public", "zyngram-logo.jpe"), center - 25, 40, { fit: [50, 39], align: "center" });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(16).text("ZYNGRAM", 50, 82, { width: pageWidth - 100, align: "center", characterSpacing: 0.5 });
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("CAMPUS HUB", 50, 101, { width: pageWidth - 100, align: "center", characterSpacing: 1.2 });
  doc.moveTo(center - 90, 122).lineTo(center + 90, 122).lineWidth(1.3).stroke(gold);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(17).text("CERTIFICATE OF COURSE COMPLETION", 50, 139, { width: pageWidth - 100, align: "center" });
  doc.fillColor(muted).font("Helvetica").fontSize(11).text("This certificate is proudly presented to", 50, 183, { width: pageWidth - 100, align: "center" });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(28).text(req.user.name, 50, 207, { width: pageWidth - 100, align: "center", lineBreak: false, ellipsis: true });
  doc.moveTo(center - 115, 246).lineTo(center + 115, 246).lineWidth(1).stroke(gold);
  doc.fillColor(muted).font("Helvetica").fontSize(11).text("for successfully completing the course", 50, 263, { width: pageWidth - 100, align: "center" });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(course.title.length > 52 ? 17 : 20).text(course.title, 50, 283, { width: pageWidth - 100, align: "center", lineBreak: false, ellipsis: true });
  doc.fillColor(muted).font("Helvetica").fontSize(10).text(`Awarded on ${awardedOn}`, 50, 329, { width: pageWidth - 100, align: "center" });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text(`Certificate ID: ZYN-${certificateId}`, 50, 346, { width: pageWidth - 100, align: "center" });

  const sealY = 460;
  doc.circle(center, sealY, 35).lineWidth(2).stroke("#315f9b");
  doc.circle(center, sealY, 29).lineWidth(0.8).stroke(gold);
  doc.fillColor("#315f9b").font("Helvetica-Bold").fontSize(5.5).text("ZYNGRAM CAMPUS HUB", center - 25, sealY - 19, { width: 50, align: "center" });
  doc.roundedRect(center - 8, sealY - 8, 16, 16, 3).lineWidth(1).stroke("#315f9b");
  doc.fillColor("#315f9b").font("Helvetica-Bold").fontSize(10).text("Z", center - 6, sealY - 6, { width: 12, align: "center" });
  doc.fillColor("#315f9b").font("Helvetica-Bold").fontSize(5.5).text("COMPLETION VERIFIED", center - 29, sealY + 16, { width: 58, align: "center" });
  doc.moveTo(center - 88, 482).lineTo(center + 88, 482).lineWidth(0.8).stroke("#93a0ac");
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("Kasarla Jagan Kumar", center - 110, 488, { width: 220, align: "center" });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("CEO & Founder", center - 110, 501, { width: 220, align: "center" });
  doc.fillColor(muted).font("Helvetica").fontSize(7).text("ZYNGRAM IT SERVICES PRIVATE LIMITED", center - 150, 533, { width: 300, align: "center", characterSpacing: 0.4 });
  doc.end();
}));
app.get("/api/timetable", asyncRoute(async (req, res) => {
  const classes = await database.getPlatformItems("timetable", req.user.role === "trainer"
    ? { $or: [{ trainerId: req.user.id }, { trainer: req.user.name }, { courseId: { $in: trainerCourses(req.user).map((course) => course.id) } }] }
    : {}, { day: 1, startTime: 1 });
  return res.json(classes.map((item) => ({
    ...item,
    course: courseFor(item.courseId)?.title || item.title
  })));
}));
const timetableConflict = (items, candidate, excludedId = "") => items.find((item) => item.id !== excludedId && item.status !== "completed"
  && item.day === candidate.day
  && candidate.startTime < item.endTime && candidate.endTime > item.startTime
  && ((candidate.trainerId && (item.trainerId === candidate.trainerId
    || (!item.trainerId && item.trainer?.toLowerCase() === candidate.trainer?.toLowerCase())))
    || (candidate.room && item.room?.toLowerCase() === candidate.room.toLowerCase())));
app.get("/api/events", asyncRoute(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const events = await database.getPlatformItems("events", { date: { $gte: today } }, { date: 1, startTime: 1 });
  return res.json(events.map(({ registrations = [], checkedInUsers = [], ...event }) => ({
    ...event,
    registrationCount: registrations.length,
    registered: registrations.includes(req.user.id),
    checkedIn: checkedInUsers.includes(req.user.id)
  })));
}));
app.post("/api/events", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { title, description, date, startTime, location, category, capacity } = req.body || {};
  if (!safeText(title, 120) || !safeText(description, 1000) || !isValidDate(date)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !safeText(location, 120)
    || !["Workshop", "Showcase", "Career", "Community", "Other"].includes(category)
    || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    return res.status(400).json({ error: "Provide an event title, description, valid date/time, location, category, and capacity from 1 to 500." });
  }
  if (date < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "Choose today or a future date for the campus event." });
  }
  const event = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(), date, startTime, location: location.trim(), category, capacity, registrations: [], createdBy: req.user.id };
  await database.createPlatformItem("events", event);
  return res.status(201).json({ ...event, registrationCount: 0, registered: false });
}));
app.patch("/api/events/:eventId", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { title, description, date, startTime, location, category, capacity } = req.body || {};
  const collection = await database.getPlatformCollection("events");
  const event = await collection.findOne({ _id: req.params.eventId });
  if (!event) return res.status(404).json({ error: "That campus event could not be found." });
  if (!safeText(title, 120) || !safeText(description, 1000) || !isValidDate(date)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !safeText(location, 120)
    || !["Workshop", "Showcase", "Career", "Community", "Other"].includes(category)
    || !Number.isInteger(capacity) || capacity < (event.registrations?.length || 0) || capacity > 500) {
    return res.status(400).json({ error: "Provide valid event details and a capacity that includes current registrations." });
  }
  if (date < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "Choose today or a future date for the campus event." });
  }
  const updated = { title: title.trim(), description: description.trim(), date, startTime, location: location.trim(), category, capacity };
  await collection.updateOne({ _id: event._id }, { $set: { ...updated, updatedAt: new Date() } });
  await notifyUsers(event.registrations || [], `Event updated: ${updated.title}`, `${date} · ${startTime} · ${location}`, "event");
  return res.json({ id: event._id, ...updated, registrationCount: event.registrations?.length || 0 });
}));
app.post("/api/events/:eventId/register", allowedRoles("student"), asyncRoute(async (req, res) => {
  const collection = await database.getPlatformCollection("events");
  const event = await collection.findOne({ _id: req.params.eventId });
  if (!event || event.date < new Date().toISOString().slice(0, 10)) return res.status(404).json({ error: "That upcoming event could not be found." });
  if (event.registrations?.includes(req.user.id)) return res.json({ registered: true, registrationCount: event.registrations.length });
  const result = await collection.updateOne(
    { _id: event._id, registrations: { $ne: req.user.id }, $expr: { $lt: [{ $size: { $ifNull: ["$registrations", []] } }, "$capacity"] } },
    { $addToSet: { registrations: req.user.id }, $set: { updatedAt: new Date() } }
  );
  if (!result.matchedCount) return res.status(409).json({ error: "This event is full. Please choose another campus event." });
  return res.json({ registered: true, registrationCount: (event.registrations || []).length + 1 });
}));
app.post("/api/events/:eventId/check-in-code", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const event = await database.getPlatformItem("events", { _id: req.params.eventId });
  if (!event || event.date !== new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "Event check-in codes can only be created on the event day." });
  }
  const code = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await database.createPlatformItem("checkin_tokens", {
    id: crypto.randomUUID(), tokenHash: crypto.createHash("sha256").update(code).digest("hex"),
    kind: "event", eventId: event.id, expiresAt, createdBy: req.user.id
  });
  return res.status(201).json({
    code, expiresAt: expiresAt.toISOString(),
    qrDataUrl: await QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 2, width: 240 })
  });
}));
app.post("/api/events/:eventId/check-in", allowedRoles("student"), asyncRoute(async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const tokenHash = crypto.createHash("sha256").update(code).digest("hex");
  const token = await database.getPlatformItem("checkin_tokens", { tokenHash, kind: "event", eventId: req.params.eventId });
  if (!token || token.expiresAt <= new Date()) return res.status(401).json({ error: "This event QR code is invalid or has expired." });
  const events = await database.getPlatformCollection("events");
  const event = await events.findOne({ _id: req.params.eventId, registrations: req.user.id });
  if (!event || event.date !== new Date().toISOString().slice(0, 10)) {
    return res.status(403).json({ error: "Register for this event on its event page before checking in." });
  }
  if (event.checkedInUsers?.includes(req.user.id)) return res.status(409).json({ error: "You are already checked in for this event." });
  const result = await events.updateOne(
    { _id: event._id, registrations: req.user.id, checkedInUsers: { $ne: req.user.id } },
    { $addToSet: { checkedInUsers: req.user.id }, $set: { updatedAt: new Date() } }
  );
  if (!result.modifiedCount) return res.status(409).json({ error: "You are already checked in for this event." });
  return res.json({ checkedIn: true, event: event.title });
}));
app.delete("/api/events/:eventId", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const events = await database.getPlatformCollection("events");
  const result = await events.deleteOne({ _id: req.params.eventId });
  if (!result.deletedCount) return res.status(404).json({ error: "That campus event could not be found." });
  return res.json({ ok: true });
}));
app.get("/api/trainers", allowedRoles("trainer", "coordinator", "administrator"), (req, res) => res.json(data.users
  .filter((user) => user.role === "trainer" && (req.user.role !== "trainer" || user.id === req.user.id))
  .map(({ id, name, email, title, phone, skills }) => ({
    id, name, email, title, phone, skills,
    courseCount: data.courses.filter((course) => course.trainerId === id || course.trainer === name).length
  }))));
app.get("/api/coordinator/trainers", allowedRoles("coordinator"), asyncRoute(async (_req, res) => {
  const [batches, classes] = await Promise.all([
    database.getPlatformItems("batches"),
    database.getPlatformItems("timetable")
  ]);
  return res.json(data.users.filter((user) => user.role === "trainer").map((user) => ({
    id: user.id,
    trainerId: user.trainerId || `TRN-${user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`,
    name: user.name,
    email: user.email,
    title: user.title,
    phone: user.phone || "",
    skills: user.skills || "",
    courses: data.courses.filter((course) => course.trainerId === user.id || course.trainer === user.name).map((course) => course.title),
    batches: batches.filter((batch) => batch.trainerId === user.id).map((batch) => batch.name),
    upcomingClasses: classes.filter((item) => item.trainerId === user.id && item.status !== "completed").length
  })));
}));
app.get("/api/batches", allowedRoles("trainer", "coordinator", "administrator"), asyncRoute(async (req, res) => {
  const filter = req.user.role === "trainer" ? { trainerId: req.user.id } : {};
  const batches = await database.getPlatformItems("batches", filter, { startDate: 1 });
  return res.json(batches.map((batch) => ({
    ...batch,
    course: courseFor(batch.courseId)?.title || "Course",
    trainer: data.users.find((user) => user.id === batch.trainerId)?.name || "Trainer",
    status: batch.status || (batch.startDate > new Date().toISOString().slice(0, 10) ? "upcoming"
      : batch.endDate && batch.endDate < new Date().toISOString().slice(0, 10) ? "completed" : "active"),
    learners: (batch.learnerIds || []).map((learnerId) => data.users.find((user) => user.id === learnerId))
      .filter(Boolean).map(({ id, name, email }) => ({ id, name, email }))
  })));
}));
app.post("/api/batches", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { name, courseId, trainerId, capacity, startDate } = req.body || {};
  const trainer = data.users.find((user) => user.id === trainerId && user.role === "trainer");
  if (!safeText(name, 120) || !courseFor(courseId) || !trainer || !isValidDate(startDate)
    || !Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
    return res.status(400).json({ error: "Provide a batch name, course, trainer, valid start date, and capacity from 1 to 200." });
  }
  if (await database.getPlatformItem("batches", { name: name.trim() })) return res.status(409).json({ error: "A batch with that name already exists." });
  const batch = {
    id: crypto.randomUUID(), name: name.trim(), courseId, trainerId, capacity, startDate, endDate: "",
    status: startDate > new Date().toISOString().slice(0, 10) ? "upcoming" : "active", learnerIds: []
  };
  await database.createPlatformItem("batches", batch);
  return res.status(201).json({ ...batch, course: courseFor(courseId).title, trainer: trainer.name, learners: [] });
}));
app.patch("/api/batches/:batchId", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { name, courseId, trainerId, capacity, startDate, endDate = "", status } = req.body || {};
  const trainer = data.users.find((user) => user.id === trainerId && user.role === "trainer");
  const batches = await database.getPlatformCollection("batches");
  const batch = await batches.findOne({ _id: req.params.batchId });
  if (!batch) return res.status(404).json({ error: "That campus batch could not be found." });
  if (!safeText(name, 120) || !courseFor(courseId) || !trainer || !isValidDate(startDate)
    || (endDate && (!isValidDate(endDate) || endDate < startDate))
    || !Number.isInteger(capacity) || capacity < (batch.learnerIds?.length || 0) || capacity > 200
    || !["upcoming", "active", "completed"].includes(status)) {
    return res.status(400).json({ error: "Provide a valid batch name, course, trainer, date range, status, and capacity that fits current learners." });
  }
  if (await database.getPlatformItem("batches", { name: name.trim(), _id: { $ne: batch._id } })) {
    return res.status(409).json({ error: "A batch with that name already exists." });
  }
  const updated = { name: name.trim(), courseId, trainerId, capacity, startDate, endDate, status };
  await batches.updateOne({ _id: batch._id }, { $set: { ...updated, updatedAt: new Date() } });
  await notifyUsers([
    batch.trainerId, trainerId, ...(batch.learnerIds || [])
  ], `Batch updated: ${updated.name}`, `${courseFor(courseId).title} · ${startDate}${endDate ? ` to ${endDate}` : ""}`, "batch");
  return res.json({ id: batch._id, ...updated, course: courseFor(courseId).title, trainer: trainer.name });
}));
app.post("/api/batches/:batchId/learners", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const learnerId = req.body?.learnerId;
  const learner = data.users.find((user) => user.id === learnerId && user.role === "student");
  const batches = await database.getPlatformCollection("batches");
  const batch = await batches.findOne({ _id: req.params.batchId });
  if (!batch) return res.status(404).json({ error: "That campus batch could not be found." });
  if (!learner) return res.status(400).json({ error: "Choose a valid student account to allocate." });
  if (batch.learnerIds?.includes(learnerId)) return res.json({ allocated: true, alreadyAllocated: true });
  const result = await batches.updateOne(
    { _id: batch._id, learnerIds: { $ne: learnerId }, $expr: { $lt: [{ $size: { $ifNull: ["$learnerIds", []] } }, "$capacity"] } },
    { $addToSet: { learnerIds: learnerId }, $set: { updatedAt: new Date() } }
  );
  if (!result.matchedCount) return res.status(409).json({ error: "This batch has reached capacity." });
  const course = courseFor(batch.courseId);
  await batches.updateMany(
    { _id: { $ne: batch._id }, courseId: batch.courseId, learnerIds: learnerId },
    { $pull: { learnerIds: learnerId }, $set: { updatedAt: new Date() } }
  );
  if (!course.enrolled.includes(learnerId)) {
    course.enrolled.push(learnerId);
    await persist();
  }
  await notifyUsers([learnerId], "Batch allocation updated", `You are assigned to ${batch.name} for ${course.title}.`, "batch");
  return res.status(201).json({ allocated: true, batchId: batch.id, learnerId, courseId: batch.courseId });
}));
app.delete("/api/batches/:batchId/learners/:learnerId", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const batches = await database.getPlatformCollection("batches");
  const batch = await batches.findOne({ _id: req.params.batchId });
  if (!batch) return res.status(404).json({ error: "That campus batch could not be found." });
  const result = await batches.updateOne({ _id: batch._id, learnerIds: req.params.learnerId }, {
    $pull: { learnerIds: req.params.learnerId }, $set: { updatedAt: new Date() }
  });
  if (!result.modifiedCount) return res.status(404).json({ error: "That student is not allocated to this batch." });
  const stillAssigned = await batches.findOne({ courseId: batch.courseId, learnerIds: req.params.learnerId });
  const course = courseFor(batch.courseId);
  if (!stillAssigned && course) {
    course.enrolled = course.enrolled.filter((studentId) => studentId !== req.params.learnerId);
    await persist();
  }
  await notifyUsers([req.params.learnerId], "Batch allocation changed", `You have been removed from ${batch.name}.`, "batch");
  return res.json({ removed: true, batchId: batch.id, learnerId: req.params.learnerId });
}));
app.post("/api/community/groups", allowedRoles("student"), asyncRoute(async (req, res) => {
  const { name, topic, schedule } = req.body || {};
  if (!safeText(name, 100) || !safeText(topic, 160) || !safeText(schedule, 100)) {
    return res.status(400).json({ error: "Add a group name, topic, and meeting schedule." });
  }
  const group = { id: crypto.randomUUID(), name: name.trim(), topic: topic.trim(), schedule: schedule.trim(), memberIds: [req.user.id] };
  await database.createPlatformItem("study_groups", group);
  return res.status(201).json({ ...group, memberCount: 1, joined: true });
}));
app.get("/api/notifications", asyncRoute(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const courseIds = req.user.role === "student"
    ? data.courses.filter((course) => course.enrolled.includes(req.user.id)).map((course) => course.id)
    : req.user.role === "trainer" ? trainerCourses(req.user).map((course) => course.id) : [];
  const assignments = await database.getPlatformItems("assignments", ["student", "trainer"].includes(req.user.role)
    ? { courseId: { $in: courseIds } } : {});
  const submissions = req.user.role === "trainer"
    ? await database.getPlatformItems("assignment_submissions", { assignmentId: { $in: assignments.map((item) => item.id) } })
    : req.user.role === "student"
      ? await database.getPlatformItems("assignment_submissions", { studentId: req.user.id })
      : [];
  const events = await database.getPlatformItems("events", { date: { $gte: new Date().toISOString().slice(0, 10) } }, { date: 1 });
  const [placementDrives, placementApplications] = req.user.role === "student" ? await Promise.all([
    database.getPlatformItems("placement_drives", { status: "published", registrationEnd: { $gte: today } }, { registrationEnd: 1 }),
    database.getPlatformItems("placement_applications", { studentId: req.user.id })
  ]) : [[], []];
  const timetable = await database.getPlatformItems("timetable", req.user.role === "trainer"
    ? { $or: [{ trainerId: req.user.id }, { courseId: { $in: courseIds } }] }
    : req.user.role === "student" ? { courseId: { $in: courseIds } } : {});
  const upcomingClassNotices = timetable.filter((item) => item.status !== "completed").map((item) => {
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(item.day);
    if (weekday < 0) return null;
    const now = new Date();
    const [hours, minutes] = item.startTime.split(":").map(Number);
    let daysUntil = (weekday - now.getDay() + 7) % 7;
    if (daysUntil === 0 && (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes()))) daysUntil = 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hours, minutes);
    return { id: `class-${item.id}`, kind: "class", title: `Class reminder: ${item.title}`, detail: `${item.startTime}–${item.endTime} · ${item.room}`, date: date.toISOString().slice(0, 10), dateTime: date };
  }).filter((item) => item && item.date >= today).sort((left, right) => left.dateTime - right.dateTime).slice(0, 6);
  const notices = [
    ...data.announcements.filter((item) => courseAnnouncementVisible(item, req.user)).slice(0, 4).map((item) => ({ id: `announcement-${item.id}`, kind: "announcement", title: item.title, detail: item.body, date: item.date })),
    ...data.tasks.filter((task) => task.status !== "submitted" && task.due >= today && courseFor(task.courseId)?.enrolled.includes(req.user.id)).map((task) => ({ id: `task-${task.id}`, kind: "assignment", title: `Due soon: ${task.title}`, detail: courseFor(task.courseId)?.title || "Course assignment", date: task.due })),
    ...assignments.filter((item) => item.due >= today && (req.user.role !== "student" || !submissions.some((submission) => submission.assignmentId === item.id))).map((item) => ({ id: `assignment-${item.id}`, kind: "assignment", title: `Assignment: ${item.title}`, detail: item.detail, date: item.due })),
    ...submissions.map((submission) => {
      const assignment = assignments.find((item) => item.id === submission.assignmentId);
      return {
        id: `submission-${submission.id}`,
        kind: "assignment",
        title: req.user.role === "trainer"
          ? `Submission to review: ${assignment?.title || "Course assignment"}`
          : `Assignment reviewed: ${assignment?.title || "Course assignment"}`,
        detail: req.user.role === "trainer"
          ? `${data.users.find((user) => user.id === submission.studentId)?.name || "A learner"} submitted work.`
          : submission.status === "reviewed" ? `Marks: ${submission.marks}/${assignment?.points || "—"} · ${submission.feedback || "Feedback is ready."}` : "Your work is awaiting trainer feedback.",
        date: String(submission.submittedAt || submission.reviewedAt || "").slice(0, 10)
      };
    }),
    ...events.filter((item) => req.user.role !== "student" || item.registrations?.includes(req.user.id)).map((item) => ({ id: `event-${item.id}`, kind: "event", title: `Campus event: ${item.title}`, detail: `${item.date} · ${item.startTime} · ${item.location}`, date: item.date })),
    ...placementDrives.filter((drive) => !placementApplications.some((application) => application.driveId === drive.id))
      .map((drive) => ({ id: `drive-${drive.id}`, kind: "placement", title: `Placement drive registration: ${drive.roleTitle}`, detail: `${drive.companyName} · closes ${drive.registrationEnd}`, date: drive.registrationEnd })),
    ...upcomingClassNotices,
    ...(req.user.role === "student" ? (await database.getPlatformItems("placement_interviews", { studentId: req.user.id, status: { $in: ["scheduled", "rescheduled"] } }))
      .filter((item) => new Date(item.scheduledAt) >= new Date())
      .map((item) => ({ id: `interview-${item.id}`, kind: "placement", title: `Upcoming interview: ${item.roundType}`, detail: `${item.venue || "Interview"} · ${item.meetingLink || "Check your placement page"}`, date: String(item.scheduledAt).slice(0, 10) })) : [])
  ];
  notices.push(...(await database.getPlatformItems("notifications", { userId: req.user.id }))
    .map(({ id, kind, title, detail, date }) => ({ id, kind, title, detail, date: String(date).slice(0, 10) })));
  return res.json(notices.sort((left, right) => String(left.date).localeCompare(String(right.date))));
}));
app.get("/api/analytics", asyncRoute(async (req, res) => {
  const trainerCourseIds = req.user.role === "trainer" ? trainerCourses(req.user).map((course) => course.id) : [];
  const records = data.attendance.filter((entry) => req.user.role === "student"
    ? entry.studentId === req.user.id
    : req.user.role !== "trainer" || trainerCourseIds.includes(entry.courseId));
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const month = monthDate.toISOString().slice(0, 7);
    const entries = records.filter((entry) => entry.date.startsWith(month));
    return { month, label: monthDate.toLocaleDateString("en", { month: "short" }), attended: entries.filter((entry) => entry.status !== "absent").length, total: entries.length };
  });
  const byCourse = data.courses
    .filter((course) => req.user.role === "student" ? course.enrolled.includes(req.user.id)
      : req.user.role !== "trainer" || trainerCourseIds.includes(course.id))
    .map((course) => {
      const courseRecords = records.filter((entry) => entry.courseId === course.id);
      const attendance = courseRecords.length ? Math.round(courseRecords.filter((entry) => entry.status !== "absent").length / courseRecords.length * 100) : 0;
      return { courseId: course.id, course: course.title, attendance, lowAttendance: courseRecords.length > 0 && attendance < 75 };
    });
  const scores = await database.getPlatformItems("quiz_attempts", req.user.role === "student" ? { userId: req.user.id }
    : req.user.role === "trainer" ? { courseId: { $in: trainerCourseIds } } : {});
  const assignmentIds = req.user.role === "trainer"
    ? (await database.getPlatformItems("assignments", { courseId: { $in: trainerCourseIds } })).map((item) => item.id)
    : [];
  const submissions = await database.getPlatformItems("assignment_submissions", req.user.role === "student"
    ? { studentId: req.user.id }
    : req.user.role === "trainer" ? { assignmentId: { $in: assignmentIds } } : {});
  return res.json({
    months,
    byCourse,
    attendancePercent: records.length ? Math.round(records.filter((entry) => entry.status !== "absent").length / records.length * 100) : 0,
    quizAverage: scores.length ? Math.round(scores.reduce((sum, item) => sum + item.percentage, 0) / scores.length) : 0,
    assignmentAverage: submissions.filter((item) => Number.isFinite(item.marks)).length
      ? Math.round(submissions.filter((item) => Number.isFinite(item.marks)).reduce((sum, item) => sum + item.marks, 0) / submissions.filter((item) => Number.isFinite(item.marks)).length)
      : null
  });
}));
app.get("/api/learning-path", allowedRoles("student"), asyncRoute(async (req, res) => {
  const saved = await database.getPlatformItem("learning_paths", { userId: req.user.id });
  if (saved) return res.json(saved);
  const goal = "Web Developer";
  return res.json({ goal, weeks: careerPaths[goal] });
}));
app.patch("/api/learning-path", allowedRoles("student"), asyncRoute(async (req, res) => {
  const { goal } = req.body || {};
  if (typeof goal !== "string" || !Object.hasOwn(careerPaths, goal)) return res.status(400).json({ error: "Choose one of the available career goals." });
  const item = await database.getPlatformItem("learning_paths", { userId: req.user.id });
  const value = { goal, weeks: careerPaths[goal], updatedAt: new Date() };
  if (item) await database.updatePlatformItem("learning_paths", { userId: req.user.id }, value);
  else await database.createPlatformItem("learning_paths", { id: crypto.randomUUID(), userId: req.user.id, ...value });
  return res.json({ goal, weeks: careerPaths[goal] });
}));
app.get("/api/gamification", asyncRoute(async (req, res) => {
  const [mine, records] = await Promise.all([
    database.getPlatformItem("gamification", { userId: req.user.id }),
    database.getPlatformItems("gamification", {}, { points: -1 })
  ]);
  const leaderboard = records.slice(0, 10).map((record, index) => ({
    rank: index + 1,
    name: data.users.find((user) => user.id === record.userId)?.name || "Learner",
    points: record.points || 0,
    badges: record.badges || [],
    isMe: record.userId === req.user.id
  }));
  if (!leaderboard.some((row) => row.isMe)) leaderboard.push({ rank: leaderboard.length + 1, name: req.user.name, points: mine?.points || 0, badges: mine?.badges || [], isMe: true });
  return res.json({ points: mine?.points || 0, streak: mine?.streak || 0, badges: mine?.badges || [], leaderboard });
}));
app.get("/api/community", asyncRoute(async (req, res) => {
  const [posts, groups] = await Promise.all([
    database.getPlatformItems("discussions", {}, { createdAt: -1 }),
    database.getPlatformItems("study_groups", {}, { name: 1 })
  ]);
  return res.json({
    posts: posts.map(({ comments = [], ...post }) => ({
      ...post,
      comments,
      author: data.users.find((user) => user.id === post.userId)?.name || "Learner",
      isMine: post.userId === req.user.id
    })),
    groups: groups.map((group) => ({ ...group, memberCount: group.memberIds?.length || 0, joined: group.memberIds?.includes(req.user.id) || false }))
  });
}));
app.post("/api/community/posts", allowedRoles("student", "trainer", "coordinator", "placement_officer"), asyncRoute(async (req, res) => {
  if (!safeText(req.body?.title, 120) || !safeText(req.body?.body, 1200)) return res.status(400).json({ error: "Add a short topic and a message of up to 1,200 characters." });
  const post = { id: crypto.randomUUID(), title: req.body.title.trim(), body: req.body.body.trim(), userId: req.user.id, comments: [] };
  await database.createPlatformItem("discussions", post);
  return res.status(201).json({ ...post, author: req.user.name, isMine: true });
}));
app.post("/api/community/posts/:postId/comments", asyncRoute(async (req, res) => {
  if (!safeText(req.body?.body, 500)) return res.status(400).json({ error: "Add a reply of up to 500 characters." });
  const collection = await database.getPlatformCollection("discussions");
  const result = await collection.updateOne(
    { _id: req.params.postId },
    { $push: { comments: { id: crypto.randomUUID(), userId: req.user.id, author: req.user.name, body: req.body.body.trim(), createdAt: new Date() } }, $set: { updatedAt: new Date() } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: "That discussion could not be found." });
  return res.status(201).json({ ok: true });
}));
app.post("/api/community/groups/:groupId/join", allowedRoles("student"), asyncRoute(async (req, res) => {
  const collection = await database.getPlatformCollection("study_groups");
  const result = await collection.updateOne({ _id: req.params.groupId }, { $addToSet: { memberIds: req.user.id }, $set: { updatedAt: new Date() } });
  if (!result.matchedCount) return res.status(404).json({ error: "That study group could not be found." });
  return res.json({ joined: true });
}));
app.get("/api/careers", asyncRoute(async (req, res) => {
  const jobs = await database.getPlatformItems("jobs", {}, { createdAt: -1 });
  const user = await database.getPlatformItem("gamification", { userId: req.user.id });
  return res.json({ jobs, mockQuestions: mockInterviewQuestions, placementProgress: user?.placementProgress || 0 });
}));
app.patch("/api/careers/progress", allowedRoles("student"), asyncRoute(async (req, res) => {
  const progress = req.body?.progress;
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return res.status(400).json({ error: "Placement progress must be a whole number from 0 to 100." });
  const stats = await database.getPlatformItem("gamification", { userId: req.user.id });
  if (stats) await database.updatePlatformItem("gamification", { userId: req.user.id }, { placementProgress: progress });
  else await database.createPlatformItem("gamification", { id: crypto.randomUUID(), userId: req.user.id, points: 0, streak: 0, badges: [], placementProgress: progress });
  return res.json({ placementProgress: progress });
}));
app.post("/api/careers/jobs", allowedRoles("placement_officer", "administrator"), asyncRoute(async (req, res) => {
  const { title, organization, location, type, description, applyUrl } = req.body || {};
  if (!safeText(title, 120) || !safeText(organization, 120) || !safeText(location, 120)
    || !safeText(type, 50) || !safeText(description, 1000)) return res.status(400).json({ error: "Complete the job title, organization, location, type, and description." });
  let destination;
  try { destination = new URL(applyUrl); } catch { return res.status(400).json({ error: "Enter a valid application URL." }); }
  if (destination.protocol !== "https:") return res.status(400).json({ error: "Application links must use HTTPS." });
  const job = { id: crypto.randomUUID(), title: title.trim(), organization: organization.trim(), location: location.trim(), type: type.trim(), description: description.trim(), applyUrl: destination.toString(), skills: [] };
  await database.createPlatformItem("jobs", job);
  return res.status(201).json(job);
}));
const placementOfficerRoles = ["placement_officer", "administrator"];
const placementApplicationStatuses = ["applied", "under_review", "shortlisted", "interview_scheduled", "selected", "not_selected", "withdrawn"];
const placementProfileFor = async (userId) => await database.getPlatformItem("placement_profiles", { userId })
  || { userId, skills: [], cgpa: null, graduationYear: null, courseId: "", eligibility: "pending" };
const placementEligibility = (profile) => Number.isFinite(profile.cgpa) && profile.cgpa >= 6
  ? "eligible" : Number.isFinite(profile.cgpa) ? "ineligible" : "pending";
const notifyPlacementCandidates = async (minimumCgpa, title, detail) => {
  const profiles = await database.getPlatformItems("placement_profiles");
  const eligibleIds = data.users.filter((user) => user.role === "student" && user.active !== false)
    .filter((user) => {
      const profile = profiles.find((item) => item.userId === user.id);
      return profile && placementEligibility(profile) === "eligible" && profile.cgpa >= minimumCgpa;
    }).map((user) => user.id);
  await notifyUsers(eligibleIds, title, detail, "placement");
};
const placementStudentSummary = async (user) => {
  const profile = await placementProfileFor(user.id);
  const course = data.courses.find((item) => item.id === profile.courseId);
  return {
    id: user.id, name: user.name, studentId: user.zinId || user.id, email: user.email,
    course: course?.title || user.title || "Not specified", courseId: profile.courseId || "",
    skills: profile.skills || [], cgpa: profile.cgpa ?? null, graduationYear: profile.graduationYear ?? null,
    eligibility: placementEligibility(profile), resumeAvailable: Boolean(user.resumeData?.data),
    placementStatus: profile.placementStatus || "seeking", profileUpdatedAt: profile.updatedAt || null
  };
};
const placementApplicationView = async (application) => {
  const [student, job, company, drive] = await Promise.all([
    data.users.find((user) => user.id === application.studentId),
    application.jobId ? database.getPlatformItem("placement_jobs", { _id: application.jobId }) : null,
    application.companyId ? database.getPlatformItem("placement_companies", { _id: application.companyId }) : null,
    application.driveId ? database.getPlatformItem("placement_drives", { _id: application.driveId }) : null
  ]);
  return {
    ...application,
    student: student ? { id: student.id, name: student.name, studentId: student.zinId || student.id, email: student.email } : null,
    title: job?.title || drive?.roleTitle || application.title || "Placement application",
    companyName: company?.name || drive?.companyName || application.companyName || "Company"
  };
};
app.get("/api/placement/officer/overview", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => {
  const [companies, jobs, drives, applications, interviews, offers, profiles] = await Promise.all([
    database.getPlatformItems("placement_companies"),
    database.getPlatformItems("placement_jobs"),
    database.getPlatformItems("placement_drives"),
    database.getPlatformItems("placement_applications"),
    database.getPlatformItems("placement_interviews", {}, { scheduledAt: 1 }),
    database.getPlatformItems("placement_offers"),
    database.getPlatformItems("placement_profiles")
  ]);
  const students = data.users.filter((user) => user.role === "student" && user.active !== false);
  const eligibleStudents = students.filter((user) => placementEligibility(profiles.find((profile) => profile.userId === user.id) || {}) === "eligible");
  const today = new Date().toISOString();
  const placedIds = new Set(offers.filter((offer) => offer.status === "accepted" || offer.status === "joined")
    .map((offer) => offer.studentId));
  return res.json({
    officerId: _req.user.placementOfficerId,
    counts: {
      students: students.length, eligibleStudents: eligibleStudents.length,
      companies: companies.filter((company) => company.status !== "inactive").length,
      upcomingDrives: drives.filter((drive) => drive.status === "published" && drive.driveDate >= today.slice(0, 10)).length,
      scheduledInterviews: interviews.filter((interview) => interview.status === "scheduled" && interview.scheduledAt >= today).length,
      placedStudents: placedIds.size,
      pendingOffers: offers.filter((offer) => offer.status === "offered").length,
      offersReceived: offers.filter((offer) => ["offered", "accepted", "rejected"].includes(offer.status)).length,
      activeJobs: jobs.filter((job) => job.status === "published").length,
      applications: applications.length
    },
    upcomingDrives: drives.filter((drive) => drive.status === "published" && drive.driveDate >= today.slice(0, 10))
      .sort((a, b) => a.driveDate.localeCompare(b.driveDate)).slice(0, 5),
    recentApplications: await Promise.all(applications.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 6).map(placementApplicationView))
  });
}));
app.get("/api/placement/students", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const query = String(req.query.search || "").trim().toLowerCase();
  const skill = String(req.query.skill || "").trim().toLowerCase();
  const eligibility = String(req.query.eligibility || "");
  const students = await Promise.all(data.users.filter((user) => user.role === "student" && user.active !== false).map(placementStudentSummary));
  return res.json(students.filter((student) => (!eligibility || student.eligibility === eligibility)
    && (!skill || student.skills.some((item) => item.toLowerCase().includes(skill)))
    && (!query || `${student.name} ${student.studentId} ${student.email} ${student.course} ${student.skills.join(" ")}`.toLowerCase().includes(query))));
}));
app.patch("/api/placement/students/:studentId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const student = data.users.find((user) => user.id === req.params.studentId && user.role === "student");
  if (!student) return res.status(404).json({ error: "That student profile could not be found." });
  const placementStatus = req.body?.placementStatus;
  if (placementStatus !== undefined && !["seeking", "placed", "not_seeking"].includes(placementStatus)) {
    return res.status(400).json({ error: "Choose seeking, placed, or not seeking for the placement status." });
  }
  const profile = await placementProfileFor(student.id);
  if (placementStatus) profile.placementStatus = placementStatus;
  profile.updatedAt = new Date().toISOString();
  const existing = await database.getPlatformItem("placement_profiles", { userId: student.id });
  if (existing) await database.updatePlatformItem("placement_profiles", { userId: student.id }, profile);
  else await database.createPlatformItem("placement_profiles", { id: crypto.randomUUID(), ...profile });
  return res.json(await placementStudentSummary(student));
}));
app.get("/api/placement/students/:studentId/resume", allowedRoles(...placementOfficerRoles), (req, res) => {
  const student = data.users.find((user) => user.id === req.params.studentId && user.role === "student");
  const asset = student?.resumeData;
  if (!asset?.data) return res.status(404).json({ error: "This student has not uploaded a resume." });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${String(asset.fileName || "student-resume.pdf").replace(/["\r\n]/g, "")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  return res.send(Buffer.from(asset.data, "base64"));
});
app.get("/api/placement/companies", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => res.json(await database.getPlatformItems("placement_companies"))));
app.post("/api/placement/companies", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const { name, industry, website = "", recruiterName = "", recruiterEmail = "", recruiterPhone = "", notes = "" } = req.body || {};
  if (!safeText(name, 120) || !safeText(industry, 80)
    || [website, recruiterName, recruiterEmail, recruiterPhone, notes].some((value) => typeof value !== "string")
    || (recruiterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail))
    || website.length > 200 || recruiterName.length > 100 || recruiterEmail.length > 254 || recruiterPhone.length > 32 || notes.length > 1000) {
    return res.status(400).json({ error: "Enter a company name and industry with valid optional contact details." });
  }
  if (website && (!/^https:\/\//i.test(website) || (() => { try { return new URL(website).protocol !== "https:"; } catch { return true; } })())) {
    return res.status(400).json({ error: "Company websites must use a valid HTTPS URL." });
  }
  const company = { id: crypto.randomUUID(), name: name.trim(), industry: industry.trim(), website: website.trim(), recruiterName: recruiterName.trim(), recruiterEmail: recruiterEmail.trim(), recruiterPhone: recruiterPhone.trim(), notes: notes.trim(), status: "active" };
  await database.createPlatformItem("placement_companies", company);
  return res.status(201).json(company);
}));
app.patch("/api/placement/companies/:companyId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const company = await database.getPlatformItem("placement_companies", { _id: req.params.companyId });
  if (!company) return res.status(404).json({ error: "That company could not be found." });
  const { name, industry, website = "", recruiterName = "", recruiterEmail = "", recruiterPhone = "", notes = "", status = "active" } = req.body || {};
  if (!safeText(name, 120) || !safeText(industry, 80) || !["active", "inactive"].includes(status)
    || [website, recruiterName, recruiterEmail, recruiterPhone, notes].some((value) => typeof value !== "string")
    || (recruiterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail))
    || website.length > 200 || recruiterEmail.length > 254 || notes.length > 1000) return res.status(400).json({ error: "Provide valid company details and active/inactive status." });
  if (website) { try { if (new URL(website).protocol !== "https:") throw new Error(); } catch { return res.status(400).json({ error: "Company websites must use a valid HTTPS URL." }); } }
  const updated = { ...company, name: name.trim(), industry: industry.trim(), website: website.trim(), recruiterName: recruiterName.trim(), recruiterEmail: recruiterEmail.trim(), recruiterPhone: recruiterPhone.trim(), notes: notes.trim(), status };
  await database.updatePlatformItem("placement_companies", { _id: company.id }, updated);
  return res.json(updated);
}));
app.get("/api/placement/jobs", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => res.json(await database.getPlatformItems("placement_jobs"))));
app.post("/api/placement/jobs", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const { companyId, title, description, skills = [], minCgpa = 0, location, workMode = "On-site", packageText = "", deadline, positions = 1, type = "Full time", status = "draft" } = req.body || {};
  const company = await database.getPlatformItem("placement_companies", { _id: companyId });
  if (!company || company.status !== "active" || !safeText(title, 120) || !safeText(description, 2000)
    || !safeText(location, 120) || !Array.isArray(skills) || skills.length > 20 || skills.some((skill) => !safeText(skill, 40))
    || !Number.isFinite(minCgpa) || minCgpa < 0 || minCgpa > 10 || !isValidDate(deadline)
    || !Number.isInteger(positions) || positions < 1 || positions > 10000
    || !["On-site", "Hybrid", "Remote"].includes(workMode) || !["Full time", "Internship", "Part time"].includes(type)
    || !["draft", "published", "closed"].includes(status) || (status === "published" && deadline < new Date().toISOString().slice(0, 10))
    || typeof packageText !== "string" || packageText.length > 80) {
    return res.status(400).json({ error: "Provide a valid active company, job details, criteria, deadline, and posting status." });
  }
  const job = { id: crypto.randomUUID(), companyId, companyName: company.name, title: title.trim(), description: description.trim(), skills: skills.map((skill) => skill.trim()), minCgpa, location: location.trim(), workMode, packageText: packageText.trim(), deadline, positions, type, status };
  await database.createPlatformItem("placement_jobs", job);
  if (status === "published") await notifyPlacementCandidates(job.minCgpa, `New opportunity: ${job.title}`, `${company.name} · applications close ${deadline}.`);
  return res.status(201).json(job);
}));
app.patch("/api/placement/jobs/:jobId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const job = await database.getPlatformItem("placement_jobs", { _id: req.params.jobId });
  if (!job) return res.status(404).json({ error: "That job posting could not be found." });
  const { status } = req.body || {};
  let updated = { ...job, status };
  if (req.body?.title !== undefined) {
    const { companyId, title, description, skills, minCgpa, location, workMode, packageText, deadline, positions, type } = req.body;
    const company = await database.getPlatformItem("placement_companies", { _id: companyId });
    if (!company || company.status !== "active" || !safeText(title, 120) || !safeText(description, 2000)
      || !safeText(location, 120) || !Array.isArray(skills) || skills.length > 20 || skills.some((skill) => !safeText(skill, 40))
      || !Number.isFinite(minCgpa) || minCgpa < 0 || minCgpa > 10 || !isValidDate(deadline)
      || !Number.isInteger(positions) || positions < 1 || positions > 10000
      || !["On-site", "Hybrid", "Remote"].includes(workMode) || !["Full time", "Internship", "Part time"].includes(type)
      || (status === "published" && deadline < new Date().toISOString().slice(0, 10))
      || typeof packageText !== "string" || packageText.length > 80) return res.status(400).json({ error: "Provide valid company, job details, criteria, deadline, and status." });
    updated = { ...job, companyId, companyName: company.name, title: title.trim(), description: description.trim(), skills: skills.map((skill) => skill.trim()), minCgpa, location: location.trim(), workMode, packageText: packageText.trim(), deadline, positions, type, status };
  }
  if (!["draft", "published", "closed"].includes(updated.status)) return res.status(400).json({ error: "Choose draft, published, or closed status." });
  if (updated.status === "published" && updated.deadline < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "An expired opportunity cannot be published." });
  await database.updatePlatformItem("placement_jobs", { _id: job.id }, updated);
  if (updated.status === "published" && job.status !== "published") await notifyPlacementCandidates(updated.minCgpa, `New opportunity: ${updated.title}`, `${updated.companyName} · applications close ${updated.deadline}.`);
  return res.json(updated);
}));
app.get("/api/placement/drives", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => res.json(await database.getPlatformItems("placement_drives"))));
app.post("/api/placement/drives", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const { companyId, jobId = "", roleTitle, registrationStart, registrationEnd, driveDate, venue, selectionProcess = [], minCgpa = 0, status = "draft" } = req.body || {};
  const company = await database.getPlatformItem("placement_companies", { _id: companyId });
  const job = jobId ? await database.getPlatformItem("placement_jobs", { _id: jobId }) : null;
  if (!company || company.status !== "active" || (jobId && (!job || job.companyId !== companyId))
    || !safeText(roleTitle, 120) || !isValidDate(registrationStart) || !isValidDate(registrationEnd) || !isValidDate(driveDate)
    || registrationEnd < registrationStart || driveDate < registrationEnd || !safeText(venue, 200) || !Array.isArray(selectionProcess) || selectionProcess.length > 10
    || selectionProcess.some((stage) => !safeText(stage, 50)) || !Number.isFinite(minCgpa) || minCgpa < 0 || minCgpa > 10
    || !["draft", "published", "completed", "cancelled"].includes(status)) return res.status(400).json({ error: "Provide valid company, dates, venue, eligibility and selection stages for this drive." });
  const drive = { id: crypto.randomUUID(), companyId, companyName: company.name, jobId, roleTitle: roleTitle.trim(), registrationStart, registrationEnd, driveDate, venue: venue.trim(), selectionProcess: selectionProcess.map((stage) => stage.trim()), minCgpa, status };
  await database.createPlatformItem("placement_drives", drive);
  if (status === "published") await notifyPlacementCandidates(drive.minCgpa, `Placement drive: ${drive.roleTitle}`, `${company.name} · ${drive.driveDate} · ${drive.venue}`);
  return res.status(201).json(drive);
}));
app.patch("/api/placement/drives/:driveId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const drive = await database.getPlatformItem("placement_drives", { _id: req.params.driveId });
  if (!drive) return res.status(404).json({ error: "That placement drive could not be found." });
  const { status } = req.body || {};
  let updated = { ...drive, status };
  if (req.body?.roleTitle !== undefined) {
    const { companyId, jobId = "", roleTitle, registrationStart, registrationEnd, driveDate, venue, selectionProcess, minCgpa } = req.body;
    const company = await database.getPlatformItem("placement_companies", { _id: companyId });
    const job = jobId ? await database.getPlatformItem("placement_jobs", { _id: jobId }) : null;
    if (!company || company.status !== "active" || (jobId && (!job || job.companyId !== companyId))
      || !safeText(roleTitle, 120) || !isValidDate(registrationStart) || !isValidDate(registrationEnd) || !isValidDate(driveDate)
      || registrationEnd < registrationStart || driveDate < registrationEnd || !safeText(venue, 200)
      || !Array.isArray(selectionProcess) || selectionProcess.length > 10 || selectionProcess.some((stage) => !safeText(stage, 50))
      || !Number.isFinite(minCgpa) || minCgpa < 0 || minCgpa > 10) return res.status(400).json({ error: "Provide valid company, dates, venue, eligibility and selection stages for this drive." });
    updated = { ...drive, companyId, companyName: company.name, jobId, roleTitle: roleTitle.trim(), registrationStart, registrationEnd, driveDate, venue: venue.trim(), selectionProcess: selectionProcess.map((stage) => stage.trim()), minCgpa, status };
  }
  if (!["draft", "published", "completed", "cancelled"].includes(updated.status)) return res.status(400).json({ error: "Choose draft, published, completed, or cancelled status." });
  if (updated.status === "published" && (updated.registrationEnd < new Date().toISOString().slice(0, 10) || updated.driveDate < new Date().toISOString().slice(0, 10))) {
    return res.status(400).json({ error: "An expired placement drive cannot be published." });
  }
  await database.updatePlatformItem("placement_drives", { _id: drive.id }, updated);
  if (updated.status === "published" && drive.status !== "published") await notifyPlacementCandidates(updated.minCgpa, `Placement drive: ${updated.roleTitle}`, `${updated.companyName} · ${updated.driveDate} · ${updated.venue}`);
  return res.json(updated);
}));
app.get("/api/placement/applications", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => {
  const applications = await database.getPlatformItems("placement_applications", {}, { createdAt: -1 });
  return res.json(await Promise.all(applications.map(placementApplicationView)));
}));
app.patch("/api/placement/applications/:applicationId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const application = await database.getPlatformItem("placement_applications", { _id: req.params.applicationId });
  if (!application) return res.status(404).json({ error: "That application could not be found." });
  const { status, reason = "" } = req.body || {};
  if (!placementApplicationStatuses.includes(status) || typeof reason !== "string" || reason.length > 500) return res.status(400).json({ error: "Choose a valid application status and an optional reason under 500 characters." });
  const updated = { ...application, status, reason: reason.trim(), updatedAt: new Date().toISOString() };
  await database.updatePlatformItem("placement_applications", { _id: application.id }, updated);
  await notifyUsers([application.studentId], "Placement application updated", `Your application status is now ${status.replaceAll("_", " ")}.${reason ? ` ${reason.trim()}` : ""}`, "placement");
  if (status === "selected") {
    const profile = await placementProfileFor(application.studentId);
    profile.placementStatus = "placed";
    const existing = await database.getPlatformItem("placement_profiles", { userId: application.studentId });
    if (existing) await database.updatePlatformItem("placement_profiles", { userId: application.studentId }, profile);
    else await database.createPlatformItem("placement_profiles", { id: crypto.randomUUID(), ...profile });
  }
  return res.json(await placementApplicationView(updated));
}));
app.post("/api/placement/interviews", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const { applicationId, scheduledAt, roundType, venue, meetingLink = "" } = req.body || {};
  const application = await database.getPlatformItem("placement_applications", { _id: applicationId });
  const instant = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : NaN;
  if (!application || !Number.isFinite(instant) || instant < Date.now() - 60000 || !safeText(roundType, 60)
    || !safeText(venue, 200) || typeof meetingLink !== "string" || meetingLink.length > 300) return res.status(400).json({ error: "Choose an application, future interview time, round type, and venue or valid meeting link." });
  if (meetingLink) { try { if (new URL(meetingLink).protocol !== "https:") throw new Error(); } catch { return res.status(400).json({ error: "Interview meeting links must use HTTPS." }); } }
  const interview = { id: crypto.randomUUID(), applicationId, studentId: application.studentId, scheduledAt: new Date(instant).toISOString(), roundType: roundType.trim(), venue: venue.trim(), meetingLink: meetingLink.trim(), status: "scheduled" };
  await database.createPlatformItem("placement_interviews", interview);
  await database.updatePlatformItem("placement_applications", { _id: application.id }, { status: "interview_scheduled", updatedAt: new Date().toISOString() });
  await notifyUsers([application.studentId], "Placement interview scheduled", `${interview.roundType} · ${new Date(instant).toLocaleString()} · ${interview.venue}`, "placement");
  return res.status(201).json(interview);
}));
app.get("/api/placement/interviews", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => {
  const interviews = await database.getPlatformItems("placement_interviews", {}, { scheduledAt: 1 });
  return res.json(await Promise.all(interviews.map(async (interview) => {
    const application = await database.getPlatformItem("placement_applications", { _id: interview.applicationId });
    return { ...interview, application: application ? await placementApplicationView(application) : null };
  })));
}));
app.patch("/api/placement/interviews/:interviewId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const interview = await database.getPlatformItem("placement_interviews", { _id: req.params.interviewId });
  if (!interview) return res.status(404).json({ error: "That interview could not be found." });
  const { status, scheduledAt } = req.body || {};
  if (!["scheduled", "attended", "missed", "cancelled"].includes(status)) return res.status(400).json({ error: "Choose scheduled, attended, missed, or cancelled interview status." });
  const instant = scheduledAt === undefined ? Date.parse(interview.scheduledAt) : Date.parse(scheduledAt);
  if (!Number.isFinite(instant) || (status === "scheduled" && instant < Date.now() - 60000)) return res.status(400).json({ error: "Scheduled interviews must have a valid future date and time." });
  const updated = { ...interview, status, scheduledAt: new Date(instant).toISOString() };
  await database.updatePlatformItem("placement_interviews", { _id: interview.id }, updated);
  await notifyUsers([interview.studentId], "Interview schedule updated", `${interview.roundType} · ${new Date(instant).toLocaleString()} · ${status}.`, "placement");
  return res.json(updated);
}));
app.get("/api/placement/offers", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => {
  const offers = await database.getPlatformItems("placement_offers", {}, { createdAt: -1 });
  return res.json(await Promise.all(offers.map(async (offer) => {
    const student = data.users.find((user) => user.id === offer.studentId);
    return { ...offer, student: student ? { id: student.id, name: student.name, studentId: student.zinId || student.id } : null };
  })));
}));
app.post("/api/placement/offers", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const { applicationId, packageText = "", joiningDate = "" } = req.body || {};
  const application = await database.getPlatformItem("placement_applications", { _id: applicationId });
  if (!application || !["selected", "interview_scheduled", "under_review", "shortlisted"].includes(application.status)
    || typeof packageText !== "string" || packageText.length > 80 || (joiningDate && !isValidDate(joiningDate))) return res.status(400).json({ error: "Select an active candidate application and provide valid verified offer details." });
  if (await database.getPlatformItem("placement_offers", { applicationId })) return res.status(409).json({ error: "An offer is already recorded for this application." });
  const offer = { id: crypto.randomUUID(), applicationId, studentId: application.studentId, companyId: application.companyId || "", companyName: application.companyName || "", roleTitle: application.title || "", packageText: packageText.trim(), joiningDate, status: "offered", verifiedBy: req.user.id };
  await database.createPlatformItem("placement_offers", offer);
  await notifyUsers([offer.studentId], "A placement offer was recorded", `${offer.companyName} · ${offer.roleTitle}. Check with your placement office for official documents.`, "placement");
  return res.status(201).json(offer);
}));
app.patch("/api/placement/offers/:offerId", allowedRoles(...placementOfficerRoles), asyncRoute(async (req, res) => {
  const offer = await database.getPlatformItem("placement_offers", { _id: req.params.offerId });
  if (!offer) return res.status(404).json({ error: "That offer could not be found." });
  const { status, packageText = offer.packageText, joiningDate = offer.joiningDate } = req.body || {};
  if (!["offered", "accepted", "rejected", "joined"].includes(status) || typeof packageText !== "string" || packageText.length > 80
    || (joiningDate && !isValidDate(joiningDate))) return res.status(400).json({ error: "Provide valid offer status, package, and joining date." });
  const updated = { ...offer, status, packageText: packageText.trim(), joiningDate };
  await database.updatePlatformItem("placement_offers", { _id: offer.id }, updated);
  const profile = await placementProfileFor(offer.studentId);
  profile.placementStatus = ["accepted", "joined"].includes(status) ? "placed" : "seeking";
  const existing = await database.getPlatformItem("placement_profiles", { userId: offer.studentId });
  if (existing) await database.updatePlatformItem("placement_profiles", { userId: offer.studentId }, profile);
  else await database.createPlatformItem("placement_profiles", { id: crypto.randomUUID(), ...profile });
  await notifyUsers([offer.studentId], "Placement offer status updated", `Your offer status is now ${status}.`, "placement");
  return res.json(updated);
}));
app.get("/api/placement/reports", allowedRoles(...placementOfficerRoles), asyncRoute(async (_req, res) => {
  const [applications, offers, companies, drives, profiles] = await Promise.all([
    database.getPlatformItems("placement_applications"),
    database.getPlatformItems("placement_offers"),
    database.getPlatformItems("placement_companies"),
    database.getPlatformItems("placement_drives"),
    database.getPlatformItems("placement_profiles")
  ]);
  const students = data.users.filter((user) => user.role === "student" && user.active !== false);
  const eligibleCount = students.filter((user) => placementEligibility(profiles.find((profile) => profile.userId === user.id) || {}) === "eligible").length;
  const placed = new Set(offers.filter((offer) => ["accepted", "joined"].includes(offer.status)).map((offer) => offer.studentId));
  return res.json({
    students: students.length, eligibleStudents: eligibleCount, placedStudents: placed.size,
    placementPercent: eligibleCount ? Math.round(placed.size / eligibleCount * 100) : 0,
    applications: applications.length,
    shortlisted: applications.filter((item) => ["shortlisted", "interview_scheduled", "selected"].includes(item.status)).length,
    interviews: await database.getPlatformItems("placement_interviews"),
    acceptedOffers: offers.filter((item) => ["accepted", "joined"].includes(item.status)).length,
    companies: companies.map((company) => ({
      id: company.id, name: company.name,
      applications: applications.filter((item) => item.companyId === company.id || item.companyName === company.name).length,
      selections: offers.filter((item) => (item.companyId === company.id || item.companyName === company.name) && ["accepted", "joined"].includes(item.status)).length
    })),
    drives: drives.map((drive) => ({ id: drive.id, title: drive.roleTitle, company: drive.companyName, registrations: applications.filter((item) => item.driveId === drive.id).length }))
  });
}));
app.get("/api/placement/opportunities", allowedRoles("student"), asyncRoute(async (req, res) => {
  const [jobs, drives, companies, applications, profile] = await Promise.all([
    database.getPlatformItems("placement_jobs", { status: "published" }, { deadline: 1 }),
    database.getPlatformItems("placement_drives", { status: "published" }, { driveDate: 1 }),
    database.getPlatformItems("placement_companies", { status: "active" }),
    database.getPlatformItems("placement_applications", { studentId: req.user.id }),
    placementProfileFor(req.user.id)
  ]);
  const activeCompanyIds = new Set(companies.map((company) => company.id));
  const eligibleJobs = jobs.filter((job) => job.deadline >= new Date().toISOString().slice(0, 10)
    && activeCompanyIds.has(job.companyId));
  const eligibleDrives = drives.filter((drive) => drive.registrationEnd >= new Date().toISOString().slice(0, 10)
    && activeCompanyIds.has(drive.companyId));
  return res.json({ jobs: eligibleJobs, drives: eligibleDrives, applications });
}));
app.get("/api/recommendations", allowedRoles("student"), asyncRoute(async (req, res) => {
  const [profile, jobs, drives, companies, applications] = await Promise.all([
    placementProfileFor(req.user.id),
    database.getPlatformItems("placement_jobs", { status: "published", deadline: { $gte: new Date().toISOString().slice(0, 10) } }),
    database.getPlatformItems("placement_drives", { status: "published", registrationEnd: { $gte: new Date().toISOString().slice(0, 10) } }),
    database.getPlatformItems("placement_companies", { status: "active" }),
    database.getPlatformItems("placement_applications", { studentId: req.user.id })
  ]);
  const skills = [...new Set([...(profile.skills || []), ...(req.user.skills || "").split(",")].map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
  const courseRecommendations = data.courses.filter((course) => course.status !== "archived" && !course.enrolled.includes(req.user.id))
    .map((course) => {
      const terms = `${course.title} ${course.description} ${course.category}`.toLowerCase();
      const matchingSkills = skills.filter((skill) => terms.includes(skill));
      return {
        id: course.id, kind: "course", title: course.title, detail: course.description,
        reason: matchingSkills.length ? `Matches your ${matchingSkills.slice(0, 3).join(", ")} skills` : `${course.category} course to broaden your skills`,
        target: "courses", score: matchingSkills.length
      };
    }).sort((left, right) => right.score - left.score).slice(0, 4);
  const activeCompanyIds = new Set(companies.map((company) => company.id));
  const placementRecommendations = [
    ...jobs.filter((job) => activeCompanyIds.has(job.companyId)).map((item) => ({ ...item, recommendationKind: "job", date: item.deadline })),
    ...drives.filter((drive) => activeCompanyIds.has(drive.companyId)).map((item) => ({ ...item, title: item.roleTitle, recommendationKind: "drive", date: item.registrationEnd }))
  ].filter((item) => {
    const alreadyApplied = applications.some((application) => item.recommendationKind === "job"
      ? application.jobId === item.id : application.driveId === item.id);
    return !alreadyApplied && placementEligibility(profile) === "eligible" && profile.cgpa >= (item.minCgpa || 6);
  }).map((item) => {
    const matchingSkills = (item.skills || []).filter((skill) => skills.includes(skill.toLowerCase()));
    return {
      id: item.id, kind: "placement", title: item.title,
      detail: `${item.companyName || "Campus partner"} · closes ${item.date}`,
      reason: matchingSkills.length ? `Your skills match: ${matchingSkills.join(", ")}` : "You meet the current CGPA eligibility criteria",
      target: "career", score: matchingSkills.length
    };
  }).sort((left, right) => right.score - left.score).slice(0, 4);
  return res.json({ courses: courseRecommendations, placements: placementRecommendations });
}));
app.get("/api/placement/profile", allowedRoles("student"), asyncRoute(async (req, res) => res.json(await placementProfileFor(req.user.id))));
app.patch("/api/placement/profile", allowedRoles("student"), asyncRoute(async (req, res) => {
  const { skills, cgpa, graduationYear, courseId = "" } = req.body || {};
  if (!Array.isArray(skills) || skills.length > 30 || skills.some((skill) => !safeText(skill, 40))
    || !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 || !Number.isInteger(graduationYear)
    || graduationYear < 2000 || graduationYear > new Date().getFullYear() + 8
    || (courseId && !data.courses.some((course) => course.id === courseId))) return res.status(400).json({ error: "Enter valid skills, CGPA (0–10), graduation year, and course." });
  const existing = await database.getPlatformItem("placement_profiles", { userId: req.user.id });
  const profile = { ...(existing || {}), userId: req.user.id, skills: skills.map((skill) => skill.trim()), cgpa, graduationYear, courseId, eligibility: placementEligibility({ cgpa }), updatedAt: new Date().toISOString() };
  if (existing) await database.updatePlatformItem("placement_profiles", { userId: req.user.id }, profile);
  else await database.createPlatformItem("placement_profiles", { id: crypto.randomUUID(), ...profile });
  return res.json(profile);
}));
app.post("/api/placement/applications", allowedRoles("student"), asyncRoute(async (req, res) => {
  const { jobId = "", driveId = "" } = req.body || {};
  if ((!jobId && !driveId) || (jobId && driveId)) return res.status(400).json({ error: "Apply to one job or register for one drive at a time." });
  const job = jobId ? await database.getPlatformItem("placement_jobs", { _id: jobId }) : null;
  const drive = driveId ? await database.getPlatformItem("placement_drives", { _id: driveId }) : null;
  const profile = await placementProfileFor(req.user.id);
  const companyId = job?.companyId || drive?.companyId;
  const company = companyId ? await database.getPlatformItem("placement_companies", { _id: companyId }) : null;
  if (jobId && (!job || job.status !== "published" || job.deadline < new Date().toISOString().slice(0, 10) || company?.status !== "active")) return res.status(404).json({ error: "That opportunity is no longer accepting applications." });
  if (driveId && (!drive || drive.status !== "published" || drive.registrationStart > new Date().toISOString().slice(0, 10) || drive.registrationEnd < new Date().toISOString().slice(0, 10) || company?.status !== "active")) return res.status(404).json({ error: "That drive is not currently accepting registrations." });
  const requiredCgpa = job?.minCgpa ?? drive?.minCgpa ?? 0;
  if (placementEligibility(profile) !== "eligible" || profile.cgpa < requiredCgpa) return res.status(403).json({ error: "Update your placement profile and meet the opportunity's CGPA eligibility requirement before applying." });
  const opportunityKey = `${jobId ? "job" : "drive"}:${jobId || driveId}`;
  const existing = await database.getPlatformItem("placement_applications", { studentId: req.user.id, opportunityKey });
  if (existing) return res.status(409).json({ error: "You already applied or registered for this opportunity." });
  const application = {
    id: crypto.randomUUID(), studentId: req.user.id, jobId, driveId,
    opportunityKey, companyId: job?.companyId || drive?.companyId || "", companyName: job?.companyName || drive?.companyName || "",
    title: job?.title || drive?.roleTitle || "", status: "applied", reason: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  try { await database.createPlatformItem("placement_applications", application); }
  catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "You already applied or registered for this opportunity." });
    throw error;
  }
  return res.status(201).json(application);
}));
app.get("/api/ai/status", (req, res) => {
  const keys = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];
  const configured = keys.filter((key) => Boolean(process.env[key]));
  return res.json({
    mode: configured.length === 0 ? "local" : configured.length === keys.length ? "provider" : "incomplete",
    missing: keys.filter((key) => !process.env[key])
  });
});
app.post("/api/ai/assistant", allowedRoles("student", "trainer", "coordinator", "administrator", "placement_officer"), asyncRoute(async (req, res) => {
  const question = req.body?.message;
  if (!safeText(question, 1500)) return res.status(400).json({ error: "Ask a question between 1 and 1,500 characters." });
  const now = Date.now();
  const prior = assistantRequests.get(req.user.id);
  if (prior && now - prior.startedAt < 60_000 && prior.count >= 15) return res.status(429).json({ error: "You have reached the assistant's short-term request limit. Please wait a minute and try again." });
  assistantRequests.set(req.user.id, prior && now - prior.startedAt < 60_000 ? { ...prior, count: prior.count + 1 } : { startedAt: now, count: 1 });
  const normalized = question.toLowerCase();
  const outstanding = data.tasks.filter((task) => task.status !== "submitted" && courseFor(task.courseId)?.enrolled.includes(req.user.id));
  const [score, analytics] = await Promise.all([
    database.getPlatformItem("gamification", { userId: req.user.id }),
    Promise.resolve(data.attendance.filter((entry) => entry.studentId === req.user.id))
  ]);
  let answer;
  const aiSettings = [process.env.AI_BASE_URL, process.env.AI_API_KEY, process.env.AI_MODEL];
  const configuredCount = aiSettings.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < aiSettings.length) {
    return res.status(503).json({ error: "AI provider setup is incomplete. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL together in the private server .env file." });
  }
  if (configuredCount === aiSettings.length) {
    let providerBase;
    try { providerBase = new URL(process.env.AI_BASE_URL); }
    catch { return res.status(500).json({ error: "AI_BASE_URL must be a valid provider URL." }); }
    if (providerBase.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(providerBase.hostname)) {
      console.error("AI_BASE_URL must use HTTPS unless it points to a local service.");
      return res.status(500).json({ error: "The AI provider URL must use HTTPS or a local address." });
    }
    const endpoint = new URL(`${providerBase.pathname.replace(/\/+$/, "")}/chat/completions`, providerBase.origin);
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          temperature: 0.4,
          messages: [
            { role: "system", content: `You are the Zyngram Campus learning assistant. Help with learning, assignments, study plans, career preparation, and campus guidance. Be encouraging, accurate, concise, and never claim to change records. User role: ${req.user.role}. Pending assignments: ${outstanding.map((task) => task.title).join("; ") || "none"}. Attendance: ${analytics.length ? Math.round(analytics.filter((entry) => entry.status !== "absent").length / analytics.length * 100) : 0}%. Learning points: ${score?.points || 0}.` },
            { role: "user", content: question.trim() }
          ]
        })
      });
    } catch {
      console.error("Configured AI provider request failed or timed out.");
      return res.status(502).json({ error: "The AI provider could not be reached right now. Please check the private provider settings and try again." });
    }
    if (!response.ok) {
      console.error(`Configured AI provider returned HTTP ${response.status}.`);
      return res.status(502).json({ error: "The AI provider could not answer right now. Please try again or use the built-in study guidance." });
    }
    const result = await response.json();
    answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return res.status(502).json({ error: "The AI provider returned an empty answer. Please try again." });
    return res.json({ answer: answer.trim(), mode: "provider" });
  }
  if (normalized.includes("pending assignment") || normalized.includes("assignment due") || normalized.includes("homework")) {
    answer = outstanding.length
      ? `You have ${outstanding.length} pending task${outstanding.length === 1 ? "" : "s"}: ${outstanding.map((task) => `${task.title} (due ${task.due})`).join("; ")}. Open Tasks & feedback to submit your work.`
      : "You are caught up on your current assignments. Check the timetable and course lessons for your next learning step.";
  } else if (normalized.includes("study plan") || normalized.includes("plan for me")) {
    const path = await database.getPlatformItem("learning_paths", { userId: req.user.id });
    const weeks = careerPaths[path?.goal || "Web Developer"];
    answer = `Here is a simple four-week ${path?.goal || "Web Developer"} plan: ${weeks.map((week) => `Week ${week.week}: ${week.title}`).join("; ")}. Aim for three focused 30-minute sessions each week, then review your progress on Fridays.`;
  } else if (normalized.includes("attendance")) {
    const attended = analytics.filter((entry) => entry.status !== "absent").length;
    answer = `Your recorded attendance is ${analytics.length ? Math.round(attended / analytics.length * 100) : 0}% (${attended} of ${analytics.length} sessions attended). Aim to attend at least 75% of classes and check the Attendance page for course-wise details.`;
  } else if (normalized.includes("inheritance")) {
    answer = "In Java, inheritance lets a subclass reuse and specialize a parent class with `extends`. Example: `class Animal { void speak() { System.out.println(\"sound\"); } }` and `class Dog extends Animal { void fetch() { } }`. A Dog can call `speak()` and add its own behavior. Prefer composition when a type is not truly a specialized version of another.";
  } else if (normalized.includes("sql") && normalized.includes("join")) {
    answer = "A SQL JOIN combines rows from related tables. For example: `SELECT students.name, courses.title FROM enrollments JOIN students ON students.id = enrollments.student_id JOIN courses ON courses.id = enrollments.course_id;` Use a LEFT JOIN when you also want rows without a matching record.";
  } else if (normalized.includes("react") && (normalized.includes("state") || normalized.includes("hook"))) {
    answer = "React state stores information that changes over time. Call `const [count, setCount] = useState(0)` inside a component, then update it with `setCount(value => value + 1)`. The setter schedules a re-render; don't mutate state directly.";
  } else if (normalized.includes("python") && normalized.includes("function")) {
    answer = "A Python function packages reusable work: `def average(values):\\n    return sum(values) / len(values) if values else 0`. Give it one clear job, document its inputs, and test empty and typical inputs.";
  } else {
    answer = "I can help plan study sessions, explain programming concepts, and find your pending assignments. Try asking “Explain Java inheritance”, “What assignments are pending?” or “Prepare a study plan for me”. Add AI_BASE_URL, AI_API_KEY, and AI_MODEL to your private .env file to enable your OpenAI-compatible AI provider.";
  }
  return res.json({ answer, mode: "local" });
}));
app.get("/api/tasks", (req, res) => res.json(data.tasks.filter((task) => req.user.role === "student"
  ? courseFor(task.courseId)?.enrolled.includes(req.user.id)
  : req.user.role !== "trainer" || trainerOwnsCourse(courseFor(task.courseId), req.user)).map((task) => ({
  ...task,
  course: courseFor(task.courseId)?.title || "Campus learning",
  submissions: task.submissions.filter((submission) => req.user.role !== "student" || submission.studentId === req.user.id)
}))));

app.get("/api/assignments", asyncRoute(async (req, res) => {
  const courseIds = data.courses.filter((course) => course.enrolled.includes(req.user.id)).map((course) => course.id);
  const filter = req.user.role === "student"
    ? { courseId: { $in: courseIds } }
    : req.user.role === "trainer" ? { trainerId: req.user.id } : {};
  const assignments = await database.getPlatformItems("assignments", filter, { due: 1 });
  const submissions = await database.getPlatformItems("assignment_submissions");
  return res.json(assignments.map((assignment) => {
    const matches = submissions.filter((submission) => submission.assignmentId === assignment.id
      && (req.user.role !== "student" || submission.studentId === req.user.id));
    const safeSubmissions = matches.map((match) => {
      const { file, ...rest } = match;
      return {
        ...rest,
        file: file ? { name: file.name, type: file.type, size: file.size } : null,
        student: data.users.find((user) => user.id === match.studentId)?.name || "Learner"
      };
    });
    const pendingLearners = req.user.role === "coordinator"
      ? data.users.filter((user) => user.role === "student" && courseFor(assignment.courseId)?.enrolled.includes(user.id)
        && !matches.some((match) => match.studentId === user.id && match.status === "reviewed"))
        .map((user) => ({
          id: user.id,
          name: user.name,
          status: matches.some((match) => match.studentId === user.id) ? "submitted_pending_review" : "not_submitted"
        }))
      : undefined;
    return {
      ...assignment,
      course: courseFor(assignment.courseId)?.title || "Course",
      submission: safeSubmissions[0] || null,
      submissions: safeSubmissions,
      ...(pendingLearners ? { pendingLearners } : {})
    };
  }));
}));
app.post("/api/assignments", allowedRoles("trainer", "administrator"), asyncRoute(async (req, res) => {
  const { title, courseId, detail, due, points } = req.body || {};
  if (!safeText(title, 120) || !safeText(detail, 2000) || !courseFor(courseId)
    || (req.user.role === "trainer" && !trainerOwnsCourse(courseFor(courseId), req.user))
    || typeof due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(`${due}T00:00:00Z`))
    || !Number.isInteger(points) || points < 1 || points > 1000) {
    return res.status(400).json({ error: "Provide a title, enrolled course, valid due date, instructions, and points from 1 to 1,000." });
  }
  const assignment = {
    id: crypto.randomUUID(), title: title.trim(), courseId, detail: detail.trim(),
    due, points, trainerId: req.user.id, trainer: req.user.name
  };
  await database.createPlatformItem("assignments", assignment);
  return res.status(201).json({ ...assignment, course: courseFor(courseId).title, submission: null });
}));
app.post("/api/assignments/:assignmentId/submissions", allowedRoles("student"), asyncRoute(async (req, res) => {
  const assignment = await database.getPlatformItem("assignments", { _id: req.params.assignmentId });
  if (!assignment) return res.status(404).json({ error: "That assignment could not be found." });
  if (!courseFor(assignment.courseId)?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "Enroll in this course before submitting work." });
  const link = typeof req.body?.link === "string" ? req.body.link.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const rawFile = req.body?.file;
  let file;
  if (rawFile !== undefined) {
    if (!rawFile || !safeText(rawFile.name, 120) || !["application/pdf", "text/plain", "text/markdown"].includes(rawFile.type)
      || typeof rawFile.data !== "string" || !/^data:(application\/pdf|text\/plain|text\/markdown);base64,[a-z0-9+/=]+$/i.test(rawFile.data)) {
      return res.status(400).json({ error: "Upload a PDF, plain-text, or Markdown file." });
    }
    const bytes = Buffer.from(rawFile.data.slice(rawFile.data.indexOf(",") + 1), "base64");
    if (!bytes.length || bytes.length > 512 * 1024) return res.status(413).json({ error: "Assignment files must be smaller than 512 KB." });
    file = { name: rawFile.name.replace(/[\\/:*?\"<>|]/g, "_"), type: rawFile.type, size: bytes.length, data: bytes.toString("base64") };
  }
  let safeLink = "";
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
      safeLink = url.toString();
    } catch {
      return res.status(400).json({ error: "Project links must be valid HTTPS URLs." });
    }
  }
  if (!file && !safeLink && !safeText(text, 3000)) return res.status(400).json({ error: "Attach a file, add an HTTPS project link, or write a response of up to 3,000 characters." });
  const submissions = await database.getPlatformCollection("assignment_submissions");
  const previous = await submissions.findOne({ assignmentId: assignment.id, studentId: req.user.id });
  if (previous?.status === "reviewed") return res.status(409).json({ error: "This assignment has already been graded and cannot be changed." });
  const now = new Date();
  const submission = {
    id: previous?.id?.toString() || crypto.randomUUID(), assignmentId: assignment.id, studentId: req.user.id,
    text, link: safeLink, file, status: "submitted",
    submittedAt: now.toISOString(), late: now > new Date(`${assignment.due}T23:59:59`)
  };
  await submissions.updateOne(
    { assignmentId: assignment.id, studentId: req.user.id },
    { $set: { ...submission, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  const { file: _file, ...safeSubmission } = submission;
  return res.status(201).json({ submission: { ...safeSubmission, file: file ? { name: file.name, type: file.type, size: file.size } : null } });
}));
app.get("/api/assignments/submissions/:submissionId/file", allowedRoles("student", "trainer", "coordinator", "administrator"), asyncRoute(async (req, res) => {
  const submissions = await database.getPlatformCollection("assignment_submissions");
  const submission = await findAssignmentSubmission(submissions, req.params.submissionId);
  if (!submission?.file) return res.status(404).json({ error: "That submitted file could not be found." });
  const assignment = await database.getPlatformItem("assignments", { _id: submission.assignmentId });
  if (req.user.role === "student" && submission.studentId !== req.user.id) return res.status(403).json({ error: "You can only download your own submitted files." });
  if (req.user.role === "trainer" && assignment?.trainerId !== req.user.id) return res.status(403).json({ error: "You can only review files for your assignments." });
  const filename = submission.file.name.replace(/[\\r\\n"]/g, "_");
  res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"` });
  return res.send(Buffer.from(submission.file.data, "base64"));
}));
app.patch("/api/assignments/submissions/:submissionId/review", allowedRoles("trainer", "administrator"), asyncRoute(async (req, res) => {
  const submissions = await database.getPlatformCollection("assignment_submissions");
  const submission = await findAssignmentSubmission(submissions, req.params.submissionId);
  if (!submission) return res.status(404).json({ error: "That assignment submission could not be found." });
  const assignment = await database.getPlatformItem("assignments", { _id: submission.assignmentId });
  if (req.user.role === "trainer" && assignment?.trainerId !== req.user.id) return res.status(403).json({ error: "You can only review submissions for your own assignments." });
  const { marks, feedback } = req.body || {};
  if (!Number.isInteger(marks) || marks < 0 || marks > assignment.points || !safeText(feedback, 1000)) {
    return res.status(400).json({ error: `Enter marks from 0 to ${assignment.points} and feedback up to 1,000 characters.` });
  }
  await submissions.updateOne({ _id: submission._id }, { $set: { marks, feedback: feedback.trim(), status: "reviewed", reviewedAt: new Date().toISOString(), updatedAt: new Date() } });
  return res.json({ ok: true, marks, feedback: feedback.trim(), status: "reviewed" });
}));
app.post("/api/timetable", allowedRoles("trainer", "coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { title, courseId, day, startTime, endTime, trainer, trainerId, room, batchId, meetingUrl } = req.body || {};
  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const course = courseFor(courseId);
  const assignedTrainer = req.user.role === "trainer" ? req.user
    : data.users.find((user) => user.role === "trainer" && (user.id === trainerId || user.name === trainer?.trim()));
  const batch = batchId ? await database.getPlatformItem("batches", { _id: batchId }) : null;
  if (!safeText(title, 120) || !course || (req.user.role === "trainer" && !trainerOwnsCourse(course, req.user)) || !validDays.includes(day)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    || startTime >= endTime || !assignedTrainer || !safeText(room, 100)
    || (batchId && (!batch || batch.courseId !== courseId || batch.trainerId !== assignedTrainer.id))
    || (meetingUrl && (typeof meetingUrl !== "string" || !/^https:\/\//i.test(meetingUrl)))) {
    return res.status(400).json({ error: "Provide a valid course, class name, day, time, assigned trainer, room, and matching batch." });
  }
  const candidate = { day, startTime, endTime, trainerId: assignedTrainer.id, trainer: assignedTrainer.name, room: room.trim() };
  const allClasses = await database.getPlatformItems("timetable");
  const conflict = timetableConflict(allClasses, candidate);
  if (conflict) return res.status(409).json({ error: `Schedule conflict: ${assignedTrainer.name} or ${candidate.room} is already booked for ${conflict.title} (${conflict.startTime}–${conflict.endTime}).` });
  const item = {
    id: crypto.randomUUID(), title: title.trim(), courseId, day, startTime, endTime,
    trainer: assignedTrainer.name,
    trainerId: assignedTrainer.id,
    room: room.trim(), meetingUrl: meetingUrl || "", ...(batchId ? { batchId } : {}), status: "upcoming"
  };
  await database.createPlatformItem("timetable", item);
  await notifyUsers([
    assignedTrainer.id,
    ...(batch?.learnerIds || course.enrolled)
  ], `Class scheduled: ${item.title}`, `${day} · ${startTime}–${endTime} · ${item.room}`, "class");
  return res.status(201).json(item);
}));
app.patch("/api/timetable/:classId", allowedRoles("trainer", "coordinator", "administrator"), asyncRoute(async (req, res) => {
  const { title, courseId, day, startTime, endTime, room, status, trainer, trainerId, batchId, meetingUrl } = req.body || {};
  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const course = courseFor(courseId);
  const classes = await database.getPlatformCollection("timetable");
  const item = await classes.findOne({ _id: req.params.classId });
  if (!item) return res.status(404).json({ error: "That class could not be found." });
  if (req.user.role === "trainer" && item.trainerId !== req.user.id
    && item.trainer !== req.user.name && !trainerOwnsCourse(courseFor(item.courseId), req.user)) {
    return res.status(403).json({ error: "You can only update classes for your assigned courses." });
  }
  const assignedTrainer = req.user.role === "trainer" ? req.user
    : data.users.find((user) => user.role === "trainer"
      && (user.id === trainerId || user.id === item.trainerId && !trainer && !trainerId || user.name === trainer?.trim()));
  const batch = batchId ? await database.getPlatformItem("batches", { _id: batchId }) : null;
  const classStatus = status || item.status || "upcoming";
  if (!safeText(title, 120) || !course || !assignedTrainer || (req.user.role === "trainer" && !trainerOwnsCourse(course, req.user))
    || !validDays.includes(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime || !safeText(room, 100)
    || !["upcoming", "completed"].includes(classStatus)
    || (batchId && (!batch || batch.courseId !== courseId || batch.trainerId !== assignedTrainer.id))
    || (meetingUrl && (typeof meetingUrl !== "string" || !/^https:\/\//i.test(meetingUrl)))) {
    return res.status(400).json({ error: "Provide a valid course, class name, day, time, trainer, room, and matching batch." });
  }
  const candidate = { day, startTime, endTime, trainerId: assignedTrainer.id, trainer: assignedTrainer.name, room: room.trim() };
  const allClasses = await database.getPlatformItems("timetable");
  const conflict = timetableConflict(allClasses, candidate, item.id);
  if (conflict) return res.status(409).json({ error: `Schedule conflict: ${assignedTrainer.name} or ${candidate.room} is already booked for ${conflict.title} (${conflict.startTime}–${conflict.endTime}).` });
  const updated = {
    title: title.trim(), courseId, day, startTime, endTime, room: room.trim(),
    trainer: assignedTrainer.name,
    trainerId: assignedTrainer.id,
    meetingUrl: meetingUrl || item.meetingUrl || "",
    ...(batchId ? { batchId } : {}),
    status: classStatus
  };
  await classes.updateOne({ _id: item._id }, { $set: { ...updated, updatedAt: new Date() } });
  const targetBatch = updated.batchId
    ? await database.getPlatformItem("batches", { _id: updated.batchId })
    : null;
  await notifyUsers([
    assignedTrainer.id,
    ...(targetBatch?.learnerIds || course.enrolled)
  ], `Schedule updated: ${updated.title}`, `${day} · ${startTime}–${endTime} · ${updated.room}`, "class");
  return res.json({ id: item._id, ...updated, course: course.title });
}));

app.post("/api/tasks/:taskId/submissions", allowedRoles("student"), asyncRoute(async (req, res) => {
  const task = data.tasks.find((item) => item.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "That task could not be found." });
  if (!courseFor(task.courseId)?.enrolled.includes(req.user.id)) return res.status(403).json({ error: "This task isn't assigned to your account." });
  if (!safeText(req.body?.text, 3000)) return res.status(400).json({ error: "Add a response between 1 and 3,000 characters." });
  let submission = task.submissions.find((item) => item.studentId === req.user.id);
  if (submission && submission.review === "reviewed") return res.status(409).json({ error: "This task has already been approved and cannot be changed." });
  if (submission) Object.assign(submission, { text: req.body.text.trim(), submittedAt: new Date().toISOString(), review: "submitted", feedback: "" });
  else {
    submission = { id: crypto.randomUUID(), studentId: req.user.id, text: req.body.text.trim(), submittedAt: new Date().toISOString(), review: "submitted", feedback: "" };
    task.submissions.push(submission);
  }
  task.status = "submitted";
  await persist();
  res.status(201).json({ submission });
}));

app.get("/api/submissions", allowedRoles("trainer", "coordinator", "administrator"), (req, res) => {
  res.json(data.tasks.filter((task) => req.user.role !== "trainer" || trainerOwnsCourse(courseFor(task.courseId), req.user))
    .flatMap((task) => task.submissions.map((submission) => ({
    ...submission, taskId: task.id, task: task.title, course: courseFor(task.courseId)?.title || "Campus learning",
    student: data.users.find((user) => user.id === submission.studentId)?.name || "Learner"
  }))));
});

app.patch("/api/submissions/:submissionId", allowedRoles("trainer", "administrator"), asyncRoute(async (req, res) => {
  const task = data.tasks.find((item) => item.submissions.some((submission) => submission.id === req.params.submissionId));
  const submission = task?.submissions.find((item) => item.id === req.params.submissionId);
  if (!submission) return res.status(404).json({ error: "That submission could not be found." });
  if (req.user.role === "trainer" && !trainerOwnsCourse(courseFor(task.courseId), req.user)) {
    return res.status(403).json({ error: "You can only review submissions for your assigned courses." });
  }
  if (!["reviewed", "needs work"].includes(req.body?.review) || !safeText(req.body?.feedback, 1000)) {
    return res.status(400).json({ error: "Choose a review status and add feedback (up to 1,000 characters)." });
  }
  Object.assign(submission, { review: req.body.review, feedback: req.body.feedback.trim(), reviewedAt: new Date().toISOString() });
  await persist();
  res.json({ submission });
}));

app.get("/api/attendance", (req, res) => {
  res.json(data.attendance
    .filter((entry) => req.user.role === "student" ? entry.studentId === req.user.id
      : req.user.role !== "trainer" || trainerOwnsCourse(courseFor(entry.courseId), req.user))
    .map((entry) => ({ ...entry, course: courseFor(entry.courseId)?.title || "Campus learning", student: data.users.find((user) => user.id === entry.studentId)?.name || "Learner" }))
    .sort((a, b) => b.date.localeCompare(a.date)));
});

app.post("/api/attendance/check-in", allowedRoles("student"), asyncRoute(async (req, res) => {
  if (typeof req.body?.code === "string" && req.body.code) {
    const tokenHash = crypto.createHash("sha256").update(req.body.code).digest("hex");
    const token = await database.getPlatformItem("checkin_tokens", { tokenHash, kind: "attendance" });
    if (!token || token.expiresAt <= new Date()) return res.status(401).json({ error: "This attendance QR code is invalid or has expired." });
    const qrCourse = data.courses.find((item) => item.id === token.courseId && item.enrolled.includes(req.user.id));
    if (!qrCourse) return res.status(403).json({ error: "You are not enrolled in the course for this attendance session." });
    const checkInDate = new Date().toISOString().slice(0, 10);
    if (data.attendance.some((item) => item.studentId === req.user.id && item.courseId === qrCourse.id && item.date === checkInDate)) {
      return res.status(409).json({ error: "You're already checked in for this course today." });
    }
    const qrRecord = { id: crypto.randomUUID(), studentId: req.user.id, courseId: qrCourse.id, date: checkInDate, status: "present" };
    data.attendance.push(qrRecord);
    await persist();
    return res.status(201).json({ ...qrRecord, course: qrCourse.title, student: req.user.name });
  }
  return res.status(400).json({ error: "Scan a valid staff-issued attendance QR code to check in." });
}));
app.post("/api/attendance/check-in-code", allowedRoles("trainer", "administrator"), asyncRoute(async (req, res) => {
  const course = courseFor(req.body?.courseId);
  if (!course || (req.user.role === "trainer" && !trainerOwnsCourse(course, req.user))) {
    return res.status(403).json({ error: "Choose one of your assigned courses to create an attendance QR code." });
  }
  const code = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await database.createPlatformItem("checkin_tokens", {
    id: crypto.randomUUID(), tokenHash: crypto.createHash("sha256").update(code).digest("hex"),
    kind: "attendance", courseId: course.id, expiresAt, createdBy: req.user.id
  });
  return res.status(201).json({
    code, course: course.title, expiresAt: expiresAt.toISOString(),
    qrDataUrl: await QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 2, width: 240 })
  });
}));

app.get("/api/announcements", (req, res) => res.json(data.announcements
  .filter((note) => courseAnnouncementVisible(note, req.user)).map(publicAnnouncement)));
app.post("/api/announcements", allowedRoles("trainer", "coordinator", "administrator", "placement_officer"), asyncRoute(async (req, res) => {
  if (!safeText(req.body?.title, 120) || !safeText(req.body?.body, 1000)) {
    return res.status(400).json({ error: "Add a title (up to 120 characters) and message (up to 1,000 characters)." });
  }
  const courseId = req.body?.courseId || "";
  if (req.user.role === "trainer" && (!courseId || !trainerOwnsCourse(courseFor(courseId), req.user))) {
    return res.status(400).json({ error: "Choose one of your assigned courses for this announcement." });
  }
  const batchId = req.body?.batchId || "";
  const batch = batchId ? await database.getPlatformItem("batches", { _id: batchId }) : null;
  if (batchId && (!batch || !["coordinator", "administrator"].includes(req.user.role))) {
    return res.status(400).json({ error: "Choose a valid batch for this announcement." });
  }
  const selectedRoles = req.body?.selectedRoles || [];
  if (!Array.isArray(selectedRoles) || selectedRoles.some((role) => !["student", "trainer", "coordinator", "administrator", "placement_officer"].includes(role))
    || (selectedRoles.length && req.user.role !== "administrator")
    || (batchId && selectedRoles.length)) {
    return res.status(400).json({ error: "Role-targeted announcements are available to administrators; select valid recipient roles." });
  }
  const recipientIds = batch ? batch.learnerIds || []
    : selectedRoles.length ? data.users.filter((user) => selectedRoles.includes(user.role) && user.active !== false).map((user) => user.id)
      : undefined;
  const announcement = {
    id: crypto.randomUUID(), title: req.body.title.trim(), body: req.body.body.trim(),
    author: req.user.name, date: new Date().toISOString().slice(0, 10),
    tag: batchId ? "BATCH" : courseId ? (courseFor(courseId)?.category || "COURSE") : "CAMPUS",
    color: "mint", ...(courseId ? { courseId } : {}),
    ...(batchId ? { batchId } : {}), ...(recipientIds ? { recipientIds } : {})
  };
  data.announcements.unshift(announcement);
  await persist();
  if (selectedRoles.length) await notifyUsers(recipientIds, announcement.title, announcement.body, "announcement");
  if (req.user.role === "administrator") await auditAdminAction(req.user, "created_announcement", "announcement", announcement.id, announcement.title);
  res.status(201).json(publicAnnouncement(announcement));
}));

app.get("/api/support", (req, res) => res.json(data.support
  .filter((ticket) => ["administrator", "coordinator"].includes(req.user.role) || ticket.userId === req.user.id)
  .map((ticket) => ({
    ...ticket,
    user: data.users.find((user) => user.id === ticket.userId)?.name || "Campus member"
  }))));
app.post("/api/support", asyncRoute(async (req, res) => {
  if (!safeText(req.body?.subject, 100) || !safeText(req.body?.message, 1000)) {
    return res.status(400).json({ error: "Add a subject (up to 100 characters) and a message (up to 1,000 characters)." });
  }
  const category = req.body?.category || "general";
  const batchId = req.body?.batchId || "";
  const batch = batchId ? await database.getPlatformItem("batches", { _id: batchId }) : null;
  if (!["general", "batch_change", "timetable_change", "trainer_issue"].includes(category)
    || (batchId && !batch)) {
    return res.status(400).json({ error: "Choose a valid request type and, if needed, an existing batch." });
  }
  const ticket = {
    id: crypto.randomUUID(), userId: req.user.id, subject: req.body.subject.trim(),
    message: req.body.message.trim(), category, ...(batch ? { batchId: batch.id, batchName: batch.name } : {}),
    status: "open", createdAt: new Date().toISOString()
  };
  data.support.push(ticket);
  await persist();
  res.status(201).json({ ...ticket, user: req.user.name });
}));
app.patch("/api/support/:ticketId/status", allowedRoles("coordinator", "administrator"), asyncRoute(async (req, res) => {
  const ticket = data.support.find((item) => item.id === req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: "That campus request could not be found." });
  const { status, response = "" } = req.body || {};
  if (!["open", "in_progress", "resolved"].includes(status)
    || typeof response !== "string" || response.trim().length > 500) {
    return res.status(400).json({ error: "Choose Open, In Progress, or Resolved and add a response up to 500 characters." });
  }
  Object.assign(ticket, {
    status,
    response: response.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id
  });
  await persist();
  return res.json({ ...ticket, user: data.users.find((user) => user.id === ticket.userId)?.name || "Campus member" });
}));

app.patch("/api/profile", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const { name, title, bio, phone, skills } = body;
  const optionalFields = { title: 120, bio: 500, phone: 32, skills: 300 };
  if (!safeText(name, 80)) return res.status(400).json({ error: "Name must be between 1 and 80 characters." });
  for (const [field, limit] of Object.entries(optionalFields)) {
    if (typeof body[field] !== "string" || body[field].trim().length > limit) {
      return res.status(400).json({ error: `${field[0].toUpperCase()}${field.slice(1)} must be text no longer than ${limit} characters.` });
    }
  }
  const user = data.users.find((item) => item.id === req.user.id);
  const profile = {
    name: name.trim(),
    title: title.trim(),
    bio: bio.trim(),
    phone: phone.trim(),
    skills: skills.trim(),
    initials: name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  };
  if (!await database.updateUserProfile(user.id, profile)) {
    return res.status(404).json({ error: "Your profile could not be found." });
  }
  Object.assign(user, profile);
  await persist();
  Object.assign(req.user, profile);
  return res.json({ user: req.user });
}));

app.get("/api/portfolio", allowedRoles("student"), asyncRoute(async (req, res) => {
  const portfolio = await database.getPlatformItem("student_portfolios", { userId: req.user.id });
  return res.json(portfolio ? {
    headline: portfolio.headline, about: portfolio.about, projects: portfolio.projects || [],
    sharingEnabled: Boolean(portfolio.shareTokenHash)
  } : { headline: "", about: "", projects: [], sharingEnabled: false });
}));
app.put("/api/portfolio", allowedRoles("student"), asyncRoute(async (req, res) => {
  const { headline = "", about = "", projects = [] } = req.body || {};
  const validProject = (project) => project && safeText(project.title, 100)
    && typeof project.description === "string" && project.description.trim().length <= 500
    && (!project.url || (() => {
      try { return ["http:", "https:"].includes(new URL(project.url).protocol); }
      catch { return false; }
    })())
    && Array.isArray(project.skills) && project.skills.length <= 12
    && project.skills.every((skill) => safeText(skill, 40));
  if (typeof headline !== "string" || headline.trim().length > 120 || typeof about !== "string"
    || about.trim().length > 600 || !Array.isArray(projects) || projects.length > 20
    || projects.some((project) => !validProject(project))) {
    return res.status(400).json({ error: "Add a headline, short bio, and up to 20 valid projects with safe web links." });
  }
  const portfolio = {
    userId: req.user.id, headline: headline.trim(), about: about.trim(),
    projects: projects.map((project) => ({
      id: typeof project.id === "string" && project.id.length <= 80 ? project.id : crypto.randomUUID(),
      title: project.title.trim(), description: project.description.trim(),
      url: project.url?.trim() || "", skills: project.skills.map((skill) => skill.trim())
    }))
  };
  await (await database.getPlatformCollection("student_portfolios")).updateOne(
    { userId: req.user.id }, { $set: { ...portfolio, updatedAt: new Date() } }, { upsert: true }
  );
  return res.json({ ...portfolio, sharingEnabled: Boolean((await database.getPlatformItem("student_portfolios", { userId: req.user.id }))?.shareTokenHash) });
}));
app.post("/api/portfolio/share", allowedRoles("student"), asyncRoute(async (req, res) => {
  const shareToken = crypto.randomBytes(32).toString("base64url");
  await (await database.getPlatformCollection("student_portfolios")).updateOne(
    { userId: req.user.id }, { $set: { shareTokenHash: crypto.createHash("sha256").update(shareToken).digest("hex"), updatedAt: new Date() } }, { upsert: true }
  );
  return res.json({ shareToken });
}));
app.delete("/api/portfolio/share", allowedRoles("student"), asyncRoute(async (req, res) => {
  await (await database.getPlatformCollection("student_portfolios")).updateOne(
    { userId: req.user.id }, { $unset: { shareTokenHash: "" }, $set: { updatedAt: new Date() } }
  );
  return res.json({ sharingEnabled: false });
}));
app.get("/api/public/portfolio/:shareToken", asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const tokenHash = crypto.createHash("sha256").update(req.params.shareToken).digest("hex");
  const portfolio = await database.getPlatformItem("student_portfolios", { shareTokenHash: tokenHash });
  if (!portfolio) return res.status(404).json({ error: "This portfolio link is invalid or has been revoked." });
  const user = data.users.find((candidate) => candidate.id === portfolio.userId && candidate.role === "student" && candidate.active !== false);
  if (!user) return res.status(404).json({ error: "This portfolio is no longer available." });
  const [gamification, placementProfile, lessons, progress, modules, attempts] = await Promise.all([
    database.getPlatformItem("gamification", { userId: user.id }), placementProfileFor(user.id),
    database.getPlatformItems("lessons"), database.getPlatformItems("lesson_progress", { userId: user.id, completed: true }),
    database.getPlatformItems("course_modules"), database.getPlatformItems("module_attempts", { userId: user.id, passed: true })
  ]);
  const completedLessons = new Set(progress.map((item) => item.lessonId));
  const passedModules = new Set(attempts.map((item) => item.moduleId));
  const certificates = data.courses.filter((course) => course.enrolled.includes(user.id)).flatMap((course) => {
    const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
    const courseModules = modules.filter((module) => module.courseId === course.id);
    if (!courseLessons.length || !courseModules.length
      || !courseLessons.every((lesson) => completedLessons.has(lesson.id))
      || !courseModules.every((module) => passedModules.has(module.id))) return [];
    const completionDates = [
      ...progress.filter((item) => item.courseId === course.id).map((item) => new Date(item.completedAt)),
      ...attempts.filter((attempt) => attempt.courseId === course.id).map((attempt) => new Date(attempt.createdAt))
    ];
    const completedAt = completionDates.reduce((latest, value) => value > latest ? value : latest, new Date(0));
    const certificateId = crypto.createHash("sha256").update(`${user.id}:${course.id}:${completedAt.toISOString()}`).digest("hex").slice(0, 16).toUpperCase();
    return [{ course: course.title, certificateId, issuedAt: completedAt.toISOString() }];
  });
  return res.json({
    name: user.name, headline: portfolio.headline || user.title || "Campus Hub student",
    about: portfolio.about || "", skills: [...new Set([...(user.skills || "").split(","), ...(placementProfile.skills || [])].map((skill) => skill.trim()).filter(Boolean))],
    projects: portfolio.projects || [], achievements: gamification?.badges || [], certificates
  });
}));

app.get("/api/admin/overview", allowedRoles("administrator"), asyncRoute(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [batches, assignments, submissions, events, auditLogs] = await Promise.all([
    database.getPlatformItems("batches"),
    database.getPlatformItems("assignments"),
    database.getPlatformItems("assignment_submissions"),
    database.getPlatformItems("events", { date: { $gte: today } }, { date: 1 }),
    database.getPlatformItems("admin_audit_logs", {}, { createdAt: -1 })
  ]);
  const requests = data.support.filter((ticket) => ticket.status !== "resolved");
  const activities = auditLogs.slice(0, 6).map(({ id, actorName, action, targetType, detail, createdAt }) => ({
    id, actorName, action, targetType, detail, createdAt
  }));
  const alerts = [
    ...data.users.filter((user) => user.active === false).map((user) => ({ id: `inactive-${user.id}`, title: "Inactive account", detail: user.name, kind: "access" })),
    ...requests.slice(0, 3).map((ticket) => ({ id: `request-${ticket.id}`, title: "Request needs review", detail: ticket.subject, kind: "request" })),
    ...submissions.filter((submission) => submission.status !== "reviewed").slice(0, 3).map((submission) => ({ id: `review-${submission.id}`, title: "Evaluation pending", detail: "Trainer review is still needed.", kind: "academic" }))
  ].slice(0, 8);
  const batchToday = batches.filter((batch) => batch.status === "active"
    || (!batch.status && batch.startDate <= today && (!batch.endDate || batch.endDate >= today)));
  return res.json({
    counts: {
      students: data.users.filter((user) => user.role === "student" && user.active !== false).length,
      trainers: data.users.filter((user) => user.role === "trainer" && user.active !== false).length,
      coordinators: data.users.filter((user) => user.role === "coordinator" && user.active !== false).length,
      administrators: data.users.filter((user) => user.role === "administrator" && user.active !== false).length,
      activeCourses: data.courses.filter((course) => course.status !== "archived").length,
      activeBatches: batchToday.length,
      pendingRequests: requests.length,
      pendingEvaluations: assignments.length
        ? submissions.filter((submission) => submission.status !== "reviewed").length
        : data.tasks.flatMap((task) => task.submissions).filter((submission) => submission.review === "submitted").length
    },
    recentActivities: activities,
    alerts,
    upcomingEvents: events.slice(0, 4),
    settings: await database.getPlatformItem("admin_settings", { id: "main" })
  });
}));
app.get("/api/admin/users", allowedRoles("administrator"), (req, res) => {
  const query = String(req.query.search || "").trim().toLowerCase();
  const role = String(req.query.role || "");
  return res.json(data.users
    .filter((user) => (!role || user.role === role)
      && (!query || `${user.name} ${user.email} ${user.zinId || ""} ${user.role}`.toLowerCase().includes(query)))
    .map((user) => ({
      id: user.id, name: user.name, email: user.email, role: user.role, title: user.title,
      active: user.active !== false, mustChangePassword: Boolean(user.mustChangePassword),
      zinId: user.zinId, phone: user.phone || "", createdAt: user.createdAt
    })));
});
app.post("/api/admin/users", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const { name, email, role, password } = req.body || {};
  const validRoles = ["student", "trainer", "coordinator", "administrator", "placement_officer"];
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const passwordError = await validateCampusPassword(password);
  if (!safeText(name, 80) || !validRoles.includes(role) || passwordError) {
    return res.status(400).json({ error: "Enter a name, valid role, and secure password (8–128 characters with letters and numbers)." });
  }
  if (role !== "student" && !/^[^\s@]+@zyngram\.com$/i.test(normalizedEmail)) {
    return res.status(400).json({ error: "Staff accounts must use a unique @zyngram.com email address." });
  }
  if (role !== "student" && await database.findUserByEmail(normalizedEmail)) return res.status(409).json({ error: "An account already uses that email address." });
  const displayName = name.trim();
  const user = {
    id: crypto.randomUUID(), name: displayName,
    ...(role === "student" ? { zinId: createZinId(displayName), zinName: displayName } : { email: normalizedEmail }),
    role, title: role === "student" ? "Campus trainee" : roleNamesForApi[role],
    initials: displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    color: role === "trainer" ? "peach" : role === "coordinator" ? "mint" : role === "administrator" ? "blue" : "lilac",
    active: true, mustChangePassword: role !== "student", ...makePassword(password)
  };
  if (role === "student") {
    user.email = `${user.zinId.toLowerCase()}@zyngram.com`;
    if (await database.findUserByEmail(user.email)) return res.status(409).json({ error: "Could not generate a unique student login. Please try again." });
  }
  try {
    await database.createUser(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account already uses that email address." });
    throw error;
  }
  data.users.push(user);
  await persist();
  await auditAdminAction(req.user, "created_account", "user", user.id, `${role}: ${user.email}`);
  return res.status(201).json({ user: publicUser(user) });
}));
app.patch("/api/admin/users/:userId", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const { name, title, phone = "", skills = "", bio = "" } = req.body || {};
  const user = data.users.find((item) => item.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "That campus account could not be found." });
  if (!safeText(name, 80) || typeof title !== "string" || title.trim().length > 120
    || typeof phone !== "string" || phone.trim().length > 32
    || typeof skills !== "string" || skills.trim().length > 300
    || typeof bio !== "string" || bio.trim().length > 500) {
    return res.status(400).json({ error: "Provide a valid name and profile details within the allowed field lengths." });
  }
  const profile = {
    name: name.trim(), title: title.trim(), phone: phone.trim(), skills: skills.trim(), bio: bio.trim(),
    initials: name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  };
  if (!await database.updateUserProfile(user.id, profile)) return res.status(404).json({ error: "That campus account could not be found." });
  Object.assign(user, profile);
  await persist();
  await auditAdminAction(req.user, "edited_account", "user", user.id, `Updated profile for ${user.email}`);
  return res.json({ user: publicUser(user) });
}));
app.patch("/api/admin/users/:userId/status", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const user = data.users.find((item) => item.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "That campus account could not be found." });
  if (user.id === req.user.id && req.body?.active === false) return res.status(400).json({ error: "You cannot deactivate your own administrator account." });
  if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "Choose whether the account should be active." });
  if (user.id === "u-admin" && req.body.active === false) return res.status(400).json({ error: "The primary administrator account cannot be deactivated." });
  user.active = req.body.active;
  if (!await database.updateUserProfile(user.id, { active: user.active })) return res.status(404).json({ error: "That campus account could not be found." });
  if (!user.active) {
    await revokeUserSessions(user.id);
  }
  await persist();
  await auditAdminAction(req.user, user.active ? "activated_account" : "deactivated_account", "user", user.id, `${user.email} access ${user.active ? "enabled" : "disabled"}`);
  return res.json({ id: user.id, active: user.active });
}));
app.post("/api/admin/users/:userId/reset-password", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const user = data.users.find((item) => item.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "That campus account could not be found." });
  const passwordError = await validateCampusPassword(req.body?.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  const credentials = makePassword(req.body.password);
  if (!await database.updateUserProfile(user.id, { ...credentials, mustChangePassword: user.role !== "student" })) {
    return res.status(404).json({ error: "That campus account could not be found." });
  }
  Object.assign(user, credentials, { mustChangePassword: user.role !== "student" });
  await revokeUserSessions(user.id);
  await persist();
  await auditAdminAction(req.user, "reset_password", "user", user.id, `Password reset for ${user.email}`);
  return res.json({ reset: true, mustChangePassword: user.mustChangePassword });
}));
app.patch("/api/admin/users/:userId/role", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const validRoles = ["student", "trainer", "coordinator", "placement_officer", "administrator"];
  if (!validRoles.includes(req.body?.role)) return res.status(400).json({ error: "Choose a valid campus role." });
  if (req.params.userId === req.user.id) return res.status(400).json({ error: "You cannot change your own administrator role." });
  const user = data.users.find((item) => item.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "That campus account could not be found." });
  const mustChangePassword = req.body.role === "student" ? false
    : user.role === "student" || Boolean(user.mustChangePassword);
  if (!await database.updateUserProfile(user.id, {
    role: req.body.role, title: roleNamesForApi[req.body.role], mustChangePassword
  })) return res.status(404).json({ error: "That campus account could not be found." });
  user.role = req.body.role;
  user.title = roleNamesForApi[req.body.role];
  user.mustChangePassword = mustChangePassword;
  await revokeUserSessions(user.id);
  await persist();
  await auditAdminAction(req.user, "changed_role", "user", user.id, `${user.email} role changed to ${user.role}`);
  return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, title: user.title });
}));
app.get("/api/admin/permissions", allowedRoles("administrator"), (_req, res) => res.json([
  { role: "student", description: "Courses, own attendance, assignments, progress, campus events, and support requests." },
  { role: "trainer", description: "Assigned courses and batches, class attendance, assignment creation and grading, course resources, and learner feedback." },
  { role: "coordinator", description: "Campus student/trainer/batch views, scheduling, attendance monitoring, requests, announcements, and reports. Cannot change roles, record attendance, or grade assignments." },
  { role: "placement_officer", description: "Career and placement workflows." },
  { role: "administrator", description: "User lifecycle and roles, course and module administration, batches, system settings, campus reports, and audit history." }
]));
app.get("/api/admin/audit-logs", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const logs = await database.getPlatformItems("admin_audit_logs", {}, { createdAt: -1 });
  const search = String(req.query.search || "").trim().toLowerCase();
  const filtered = logs.filter((item) => !search
    || `${item.actorName} ${item.action} ${item.targetType} ${item.detail}`.toLowerCase().includes(search));
  return res.json(filtered.slice(0, 200).map(({ id, actorId, actorName, action, targetType, targetId, detail, outcome, createdAt }) => ({
    id, actorId, actorName, action, targetType, targetId, detail, outcome, createdAt
  })));
}));
app.get("/api/admin/settings", allowedRoles("administrator"), asyncRoute(async (_req, res) => {
  const settings = await database.getPlatformItem("admin_settings", { id: "main" });
  return res.json(settings || { id: "main", applicationName: "Zyngram Campus Hub", sessionHours: 8, minimumPasswordLength: 8 });
}));
app.patch("/api/admin/settings", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  const { applicationName, sessionHours, minimumPasswordLength } = req.body || {};
  if (!safeText(applicationName, 80) || !Number.isInteger(sessionHours) || sessionHours < 1 || sessionHours > 24
    || !Number.isInteger(minimumPasswordLength) || minimumPasswordLength < 8 || minimumPasswordLength > 16) {
    return res.status(400).json({ error: "Application name, session hours (1–24), or minimum password length (8–16) is invalid." });
  }
  const settings = { id: "main", applicationName: applicationName.trim(), sessionHours, minimumPasswordLength };
  const existing = await database.getPlatformItem("admin_settings", { id: "main" });
  if (existing) await database.updatePlatformItem("admin_settings", { id: "main" }, settings);
  else await database.createPlatformItem("admin_settings", settings);
  await auditAdminAction(req.user, "updated_system_settings", "settings", "main", `Updated application name and security policy settings`);
  return res.json(settings);
}));
app.get("/api/admin/reports", allowedRoles("administrator", "coordinator"), asyncRoute(async (_req, res) => {
  const assignments = await database.getPlatformItems("assignments");
  const submissions = await database.getPlatformItems("assignment_submissions");
  return res.json({
    learners: data.users.filter((user) => user.role === "student").length,
    staff: data.users.filter((user) => user.role !== "student").length,
    courses: data.courses.length,
    assignments: assignments.length + data.tasks.length,
    pendingReviews: submissions.filter((submission) => submission.status !== "reviewed").length
      + data.tasks.flatMap((task) => task.submissions).filter((submission) => submission.review === "submitted").length,
    attendancePercent: data.attendance.length ? Math.round(data.attendance.filter((entry) => entry.status !== "absent").length / data.attendance.length * 100) : 0
  });
}));

app.get("/api/modules", asyncRoute(async (_req, res) => {
  res.json(await database.getModules());
}));

app.post("/api/modules", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  if (!safeText(req.body?.title, 120) || !safeText(req.body?.category, 80) || !safeText(req.body?.description, 1000)) {
    return res.status(400).json({ error: "Add a title, category, and description within the field limits." });
  }
  const module = {
    id: crypto.randomUUID(),
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    description: req.body.description.trim()
  };
  await database.createModule(module);
  return res.status(201).json(module);
}));

app.patch("/api/modules/:moduleId", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  if (!safeText(req.body?.title, 120) || !safeText(req.body?.category, 80) || !safeText(req.body?.description, 1000)) {
    return res.status(400).json({ error: "Add a title, category, and description within the field limits." });
  }
  const module = {
    title: req.body.title.trim(),
    category: req.body.category.trim(),
    description: req.body.description.trim()
  };
  if (!await database.updateModule(req.params.moduleId, module)) {
    return res.status(404).json({ error: "That learning module could not be found." });
  }
  return res.json({ id: req.params.moduleId, ...module });
}));

app.delete("/api/modules/:moduleId", allowedRoles("administrator"), asyncRoute(async (req, res) => {
  if (!await database.deleteModule(req.params.moduleId)) {
    return res.status(404).json({ error: "That learning module could not be found." });
  }
  return res.json({ ok: true });
}));

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error.status === 413) return res.status(413).json({ error: "Request body is too large." });
  console.error("Unhandled request error:", error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
const server = app.listen(PORT, () => console.log(`Zyngram Campus Hub API listening on http://localhost:${PORT}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => {
    await database.closeDatabase();
    process.exit(0);
  }));
}
