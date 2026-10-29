import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
const databaseName = process.env.MONGODB_DB || "zyngram_campus_hub";
let database;

const defaultModules = [
  { id: "module-foundations", title: "JavaScript & Programming Foundations", category: "PROGRAMMING", description: "Learn core programming concepts, modern JavaScript, debugging, and clean code practices." },
  { id: "module-systems", title: "Full-Stack Web Development", category: "WEB DEVELOPMENT", description: "Build complete web applications with React, Node.js, Express, and REST APIs." },
  { id: "module-storytelling", title: "Database Design & Integration", category: "DATABASES", description: "Design data models and connect applications to MongoDB and relational databases." }
];
const platformCollectionNames = new Set([
  "timetable", "lessons", "resources", "quizzes", "jobs", "study_groups", "events", "batches",
  "lesson_progress", "quiz_attempts", "learning_paths", "gamification",
  "assignments", "assignment_submissions", "discussions", "notifications", "campus_state",
  "course_modules", "module_attempts", "topic_progress", "admin_audit_logs", "admin_settings",
  "api_registry", "api_consumers", "api_keys", "api_usage_logs",
  "placement_companies", "placement_jobs", "placement_drives", "placement_profiles",
  "placement_applications", "placement_interviews", "placement_offers"
]);
const canonicalStaffEmails = new Map([
  ["u-trainer", "trainer@zyngram.com"],
  ["u-coordinator", "coordinator@zyngram.com"],
  ["u-admin", "admin@zyngram.com"],
  ["u-placement", "placement@zyngram.com"]
]);

const userFromDocument = ({ _id, createdAt: _createdAt, updatedAt: _updatedAt, ...user }) => ({ id: _id, ...user });
const moduleFromDocument = ({ _id, createdAt: _createdAt, updatedAt: _updatedAt, ...module }) => ({ id: _id, ...module });

export async function initializeDatabase(seedUsers) {
  await client.connect();
  database = client.db(databaseName);

  const users = database.collection("users");
  const modules = database.collection("modules");
  await users.createIndex({ email: 1 }, { unique: true });
  await modules.createIndex({ updatedAt: -1, title: 1 });

  for (const user of seedUsers) {
    const email = (canonicalStaffEmails.get(user.id) || user.email).toLowerCase();
    const existing = await users.findOne({ _id: user.id });
    if (!existing) {
      await users.insertOne({
        ...user,
        _id: user.id,
        email,
        ...(user.role === "student" ? {} : { mustChangePassword: true }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      continue;
    }
    if (user.role !== "student") {
      const loginAliases = [...new Set([...(existing.loginAliases || []), ...(existing.email === email ? [] : [existing.email])])]
        .filter((alias) => alias !== email);
      await users.updateOne(
        { _id: user.id },
        {
          $set: {
            email,
            loginAliases,
            ...(existing.mustChangePassword === undefined ? { mustChangePassword: true } : {}),
            updatedAt: new Date()
          }
        }
      );
    }
  }
  await users.updateOne(
    { _id: "u-student", title: "Product design · Batch 08" },
    { $set: { title: "Software Development Trainee", updatedAt: new Date() } }
  );

  if (await modules.countDocuments() === 0) {
    const now = new Date();
    await modules.insertMany(defaultModules.map((module) => ({
      ...module,
      _id: module.id,
      createdAt: now,
      updatedAt: now
    })));
  } else {
    const previousModuleTitles = [
      "Product Design Foundations",
      "Design Systems in Practice",
      "Storytelling for Designers"
    ];
    for (const [index, module] of defaultModules.entries()) {
      await modules.updateOne(
        { _id: module.id, title: previousModuleTitles[index] },
        { $set: { title: module.title, category: module.category, description: module.description, updatedAt: new Date() } }
      );
    }
  }
}

export async function initializePlatformData(seeds) {
  for (const [name, records] of Object.entries(seeds)) {
    if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
    const collection = database.collection(name);
    if (name === "lesson_progress" || name === "quiz_attempts" || name === "learning_paths"
      || name === "gamification" || name === "assignment_submissions" || name === "notifications") continue;
    for (const record of records) {
      const now = new Date();
      const update = name === "course_modules"
        ? { $set: { ...record, updatedAt: now }, $setOnInsert: { _id: record.id, createdAt: now } }
        : { $setOnInsert: { ...record, _id: record.id, createdAt: now, updatedAt: now } };
      await collection.updateOne({ _id: record.id }, update, { upsert: true });
      if (name === "events" && record.date < now.toISOString().slice(0, 10)) {
        await collection.updateOne(
          { _id: record.id },
          { $set: { date: record.date, registrations: [], updatedAt: now } }
        );
      }
      if (name === "lessons" && record.moduleId) {
        await collection.updateOne({ _id: record.id }, { $set: { moduleId: record.moduleId } });
      }
    }
  }
  await database.collection("lesson_progress").createIndex({ userId: 1, lessonId: 1 }, { unique: true });
  await database.collection("quiz_attempts").createIndex({ userId: 1, quizId: 1, createdAt: -1 });
  await database.collection("learning_paths").createIndex({ userId: 1 }, { unique: true });
  await database.collection("gamification").createIndex({ userId: 1 }, { unique: true });
  await database.collection("assignment_submissions").createIndex({ assignmentId: 1, studentId: 1 }, { unique: true });
  await database.collection("module_attempts").createIndex({ userId: 1, courseId: 1, moduleId: 1, createdAt: -1 });
  await database.collection("topic_progress").createIndex({ userId: 1, topicId: 1 }, { unique: true });
  await database.collection("placement_applications").createIndex({ studentId: 1, opportunityKey: 1 }, { unique: true, partialFilterExpression: { opportunityKey: { $exists: true } } });
  await database.collection("placement_offers").createIndex({ applicationId: 1 }, { unique: true });
  await database.collection("discussions").createIndex({ createdAt: -1 });
  await database.collection("notifications").createIndex({ userId: 1, read: 1, createdAt: -1 });
  await database.collection("events").createIndex({ date: 1, startTime: 1 });
  await database.collection("batches").createIndex({ courseId: 1, trainerId: 1 });
  await database.collection("api_registry").createIndex({ id: 1 }, { unique: true });
  await database.collection("api_registry").createIndex({ status: 1, method: 1, module: 1 });
  await database.collection("api_consumers").createIndex({ id: 1 }, { unique: true });
  await database.collection("api_consumers").createIndex({ status: 1 });
  await database.collection("api_keys").createIndex({ keyHash: 1 }, { unique: true });
  await database.collection("api_keys").createIndex({ consumerId: 1, revokedAt: 1 });
  await database.collection("api_usage_logs").createIndex({ createdAt: -1 });
  await database.collection("api_usage_logs").createIndex({ apiId: 1, createdAt: -1 });
  await database.collection("api_usage_logs").createIndex({ consumerId: 1, createdAt: -1 });
}

export async function getPlatformItems(name, filter = {}, sort = { createdAt: -1 }) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  const records = await database.collection(name).find(filter).sort(sort).toArray();
  return records.map(({ _id, ...record }) => ({ id: _id, ...record }));
}

export async function getPlatformItem(name, filter = {}) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  const record = await database.collection(name).findOne(filter);
  if (!record) return undefined;
  const { _id, ...value } = record;
  return { id: _id, ...value };
}

export async function createPlatformItem(name, item) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  const now = new Date();
  await database.collection(name).insertOne({
    ...item,
    _id: item.id,
    createdAt: now,
    updatedAt: now
  });
  return item;
}

export async function updatePlatformItem(name, filter, update) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  return database.collection(name).updateOne(filter, { $set: { ...update, updatedAt: new Date() } });
}

export async function deletePlatformItem(name, filter) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  return database.collection(name).deleteOne(filter);
}

export async function incrementGamification(userId, points, badge) {
  const collection = database.collection("gamification");
  const current = await collection.findOne({ userId });
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const streak = current?.lastActivityDate === today
    ? current.streak || 1
    : current?.lastActivityDate === yesterday ? (current.streak || 0) + 1 : 1;
  const update = {
    $inc: { points },
    $set: { userId, streak, lastActivityDate: today, updatedAt: new Date() }
  };
  if (badge) update.$addToSet = { badges: badge };
  await collection.updateOne(
    { userId },
    update,
    { upsert: true }
  );
  return getPlatformItem("gamification", { userId });
}

export async function getPlatformCollection(name) {
  if (!platformCollectionNames.has(name)) throw new Error(`Unsupported platform collection: ${name}`);
  return database.collection(name);
}

export async function getCampusData() {
  const state = await database.collection("campus_state").findOne({ _id: "main" });
  return state?.data;
}

export async function saveCampusData(campusData) {
  const { users: _users, ...data } = campusData;
  await database.collection("campus_state").replaceOne(
    { _id: "main" },
    { _id: "main", data, updatedAt: new Date() },
    { upsert: true }
  );
}

export async function getUsers() {
  const users = await database.collection("users").find().sort({ createdAt: 1 }).toArray();
  return users.map(userFromDocument);
}

export async function checkConnection() {
  await database.command({ ping: 1 });
}

export async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();
  const user = await database.collection("users").findOne({
    $or: [{ email: normalizedEmail }, { loginAliases: normalizedEmail }]
  });
  return user ? userFromDocument(user) : undefined;
}

export async function createUser(user) {
  await database.collection("users").insertOne({
    ...user,
    _id: user.id,
    email: user.email.toLowerCase(),
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function updateUserProfile(userId, profile) {
  const result = await database.collection("users").updateOne(
    { _id: userId },
    { $set: { ...profile, updatedAt: new Date() } }
  );
  return result.matchedCount === 1;
}

export async function getModules() {
  const modules = await database.collection("modules")
    .find()
    .sort({ updatedAt: -1, title: 1 })
    .toArray();
  return modules.map(moduleFromDocument);
}

export async function createModule(module) {
  const now = new Date();
  await database.collection("modules").insertOne({
    ...module,
    _id: module.id,
    createdAt: now,
    updatedAt: now
  });
}

export async function updateModule(id, module) {
  const result = await database.collection("modules").updateOne(
    { _id: id },
    { $set: { ...module, updatedAt: new Date() } }
  );
  return result.matchedCount === 1;
}

export async function deleteModule(id) {
  const result = await database.collection("modules").deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function closeDatabase() {
  await client.close();
}
