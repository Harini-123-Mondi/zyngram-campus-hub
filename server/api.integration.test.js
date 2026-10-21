import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { MongoClient } from "mongodb";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { courseModules } from "./course-curriculum.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const temporaryDatabase = `zyngram_campus_hub_test_${randomUUID().replaceAll("-", "")}`;
const temporaryDataPath = path.join(os.tmpdir(), `${temporaryDatabase}.json`);

async function unusedPort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(port, environment = {}) {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URI: mongoUri,
      MONGODB_DB: temporaryDatabase,
      CAMPUS_DATA_PATH: temporaryDataPath,
      AI_BASE_URL: "",
      AI_API_KEY: "",
      AI_MODEL: "",
      ...environment
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited during startup:\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { child, baseUrl, getOutput: () => output };
    } catch {
      await delay(100);
    }
  }
  child.kill();
  throw new Error(`API did not start within 10 seconds:\n${output}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Timed out while stopping the integration-test API."));
    }, 5000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function request(baseUrl, endpoint, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = response.status === 204 ? null : await response.json();
  return { status: response.status, result, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function setupStaffAccount(baseUrl, { email, loginEmail = email, initialPassword, role, newPassword }) {
  const firstLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: loginEmail, password: initialPassword, role }
  });
  assert.equal(firstLogin.status, 200);
  assert.equal(firstLogin.result.user.email, email);
  assert.equal(firstLogin.result.user.mustChangePassword, true);
  assert.equal((await request(baseUrl, "/api/dashboard", { cookie: firstLogin.cookie })).status, 403);

  const weakPassword = await request(baseUrl, "/api/auth/change-password", {
    method: "POST",
    cookie: firstLogin.cookie,
    body: { password: "short", confirmPassword: "short" }
  });
  assert.equal(weakPassword.status, 400);
  const mismatchedPassword = await request(baseUrl, "/api/auth/change-password", {
    method: "POST",
    cookie: firstLogin.cookie,
    body: { password: newPassword, confirmPassword: `${newPassword}Mismatch` }
  });
  assert.equal(mismatchedPassword.status, 400);

  const passwordChange = await request(baseUrl, "/api/auth/change-password", {
    method: "POST",
    cookie: firstLogin.cookie,
    body: { password: newPassword, confirmPassword: newPassword }
  });
  assert.equal(passwordChange.status, 200);
  assert.equal(passwordChange.result.user.mustChangePassword, false);
  const oldPasswordLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password: initialPassword, role }
  });
  assert.equal(oldPasswordLogin.status, 401);
  const personalPasswordLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password: newPassword, role }
  });
  assert.equal(personalPasswordLogin.status, 200);
  assert.equal(personalPasswordLogin.result.user.mustChangePassword, false);
  return personalPasswordLogin;
}

async function requestBinary(baseUrl, endpoint, cookie) {
  const response = await fetch(`${baseUrl}${endpoint}`, { headers: { cookie } });
  return { status: response.status, contentType: response.headers.get("content-type"), bytes: Buffer.from(await response.arrayBuffer()) };
}

async function startMockAIProvider() {
  const requests = [];
  const server = createHttpServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      authorization: req.headers.authorization,
      path: req.url,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "Mock AI provider response for integration testing." } }] }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return { server, requests, baseUrl: `http://127.0.0.1:${port}/v1` };
}

async function stopHttpServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("local API supports validated auth, role restrictions, editable profiles, CRUD, and MongoDB restart persistence", async (t) => {
  const port = await unusedPort();
  const client = new MongoClient(mongoUri);
  let server;
  let mockAI;

  try {
    await client.connect();
    server = await startServer(port);

    const health = await request(server.baseUrl, "/api/health");
    assert.deepEqual(health.result, { status: "ok", database: "connected" });
    const users = client.db(temporaryDatabase).collection("users");
    for (const [id, email] of [
      ["u-trainer", "trainer@zyngram.demo"],
      ["u-coordinator", "coordinator@zyngram.demo"],
      ["u-admin", "admin@zyngram.demo"],
      ["u-placement", "placement@zyngram.demo"]
    ]) {
      await users.updateOne({ _id: id }, { $set: { email }, $unset: { mustChangePassword: "" } });
    }
    await stopServer(server.child);
    server = await startServer(port);

    const campusStateCollection = client.db(temporaryDatabase).collection("campus_state");
    const campusState = await campusStateCollection.findOne({ _id: "main" });
    assert.ok(campusState);
    await campusStateCollection.updateOne(
      { _id: "main" },
      { $set: { data: { ...campusState.data, courses: campusState.data.courses.filter((course) => !["c-8", "c-9"].includes(course.id)) } } }
    );
    await stopServer(server.child);
    server = await startServer(port);

    const invalidRegistration = await request(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { name: "", password: "test1234", confirmPassword: "test1234" }
    });
    assert.equal(invalidRegistration.status, 400);

    const invalidLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "student@zyngram.demo", password: "incorrect", role: "student" }
    });
    assert.equal(invalidLogin.status, 401);

    const registration = await request(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { name: "Harini Mondi", password: "TestPass123", confirmPassword: "TestPass123" }
    });
    assert.equal(registration.status, 201);
    assert.equal(registration.cookie, undefined);
    assert.match(registration.result.zinId, /^HA\d{12}NI$/);
    assert.equal(registration.result.email, `${registration.result.zinId.toLowerCase()}@zyngram.com`);
    const secondNamedStudent = await request(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { name: "Kiran Reddy", password: "TestPass123", confirmPassword: "TestPass123" }
    });
    assert.equal(secondNamedStudent.status, 201);
    assert.match(secondNamedStudent.result.zinId, /^KI\d{12}AN$/);
    assert.notEqual(secondNamedStudent.result.zinId, registration.result.zinId);
    const registrationLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: registration.result.zinId, password: "TestPass123", role: "student" }
    });
    assert.equal(registrationLogin.status, 200);
    assert.equal(registrationLogin.result.user.zinId, registration.result.zinId);
    const registrationCookie = registrationLogin.cookie;
    const zinEmailLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: registration.result.email, password: "TestPass123", role: "student" }
    });
    assert.equal(zinEmailLogin.status, 200);
    const registeredProfile = await request(server.baseUrl, "/api/auth/me", { cookie: registrationCookie });
    const registeredUserId = registeredProfile.result.user.id;
    const profilePhoto = await request(server.baseUrl, "/api/profile/assets/avatar", {
      method: "POST",
      cookie: registrationCookie,
      body: {
        fileName: "student.png",
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ksAAAAASUVORK5CYII="
      }
    });
    assert.equal(profilePhoto.status, 200);
    assert.equal(profilePhoto.result.user.avatarUrl, "/api/profile/assets/avatar");
    assert.equal("avatarData" in profilePhoto.result.user, false);
    const privatePhoto = await requestBinary(server.baseUrl, "/api/profile/assets/avatar", registrationCookie);
    assert.equal(privatePhoto.contentType, "image/png");
    const profileResume = await request(server.baseUrl, "/api/profile/assets/resume", {
      method: "POST",
      cookie: registrationCookie,
      body: { fileName: "resume.pdf", dataUrl: "data:application/pdf;base64,JVBERi0xLjQKJUVPRg==" }
    });
    assert.equal(profileResume.status, 200);
    assert.equal(profileResume.result.user.resumeFileName, "resume.pdf");
    const privateResume = await requestBinary(server.baseUrl, "/api/profile/assets/resume", registrationCookie);
    assert.equal(privateResume.contentType, "application/pdf");
    const invalidResume = await request(server.baseUrl, "/api/profile/assets/resume", {
      method: "POST",
      cookie: registrationCookie,
      body: { fileName: "resume.txt", dataUrl: "data:text/plain;base64,dGVzdA==" }
    });
    assert.equal(invalidResume.status, 400);

    const courseLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "student@zyngram.demo", password: "learn123", role: "student" }
    });
    assert.equal(courseLogin.status, 200);
    const upcomingEvents = await request(server.baseUrl, "/api/events", { cookie: courseLogin.cookie });
    assert.ok(upcomingEvents.result.length >= 3);
    assert.ok(upcomingEvents.result.every((event) => event.date >= new Date().toISOString().slice(0, 10)));
    assert.ok(upcomingEvents.result.every((event) => Number.isInteger(event.registrationCount) && event.registrationCount >= 0));
    const seededAssignments = await request(server.baseUrl, "/api/assignments", { cookie: courseLogin.cookie });
    assert.ok(seededAssignments.result.length >= 10);
    assert.ok(seededAssignments.result.every((assignment) => assignment.submission === null));
    const capstone = seededAssignments.result.find((assignment) => assignment.id === "project-campus-connect-capstone");
    assert.equal(capstone.kind, "project");
    assert.match(capstone.title, /Campus Connect/);
    assert.match(capstone.detail, /Milestones:/);
    assert.match(capstone.detail, /localStorage/);
    const courses = await request(server.baseUrl, "/api/courses", { cookie: courseLogin.cookie });
    const courseTitles = courses.result.map((course) => course.title);
    for (const title of [
      "Artificial Intelligence Fundamentals",
      "Machine Learning Foundations",
      "Full-Stack Web Development",
      "Data Structures & Algorithms",
      "Java Programming & OOP",
      "Python for AI & Data Science"
    ]) {
      assert.ok(courseTitles.includes(title), `Expected course catalog to include ${title}`);
    }
    const seededLearningContent = await request(server.baseUrl, "/api/learning-content", { cookie: courseLogin.cookie });
    for (const course of courses.result) {
      assert.ok(seededLearningContent.result.lessons.filter((lesson) => lesson.courseId === course.id).length >= 2, `${course.title} should have at least two lessons`);
      assert.ok(seededLearningContent.result.resources.some((resource) => resource.courseId === course.id), `${course.title} should have downloadable notes`);
      assert.ok(seededLearningContent.result.quizzes.some((quiz) => quiz.courseId === course.id), `${course.title} should have a quiz`);
      const modules = seededLearningContent.result.modules.filter((module) => module.courseId === course.id);
      assert.equal(modules.length, 4, `${course.title} should have a complete four-module curriculum`);
      assert.ok(modules.every((module) => module.assignment.questions.length === 5), `${course.title} modules should include harder scored assignments`);
      assert.ok(modules.every((module) => module.assignment.questions.some((question) => question.code && question.language)), `${course.title} assignments should include a code-reading MCQ`);
      assert.ok(modules.every((module) => module.assignment.questions.some((question) => !question.code) && module.assignment.questions.some((question) => question.code)), `${course.title} assignments should mix conceptual and code-reading questions`);
      assert.ok(modules.every((module) => module.assignment.questions.filter((question) => question.code).every((question) => question.code.length > 30)), `${course.title} code questions should include complete snippets`);
      assert.ok(modules.every((module) => module.assignment.questions.every((question) => !("answer" in question))), "Assessment answers must not be exposed to learners");
      assert.ok(modules.every((module) => module.topics.length === 4 && module.topics.every((topic) => topic.explanation.length > 40 && topic.videoUrl.startsWith("https://www.youtube.com/results?search_query="))), "Every topic should include an explanation and a related-video search");
    }
    assert.ok(seededLearningContent.result.courseIntroductions["c-5"].introduction.length > 50, "Machine Learning Foundations should include a course introduction");
    for (const resource of seededLearningContent.result.resources) {
      const downloadedNotes = await requestBinary(server.baseUrl, `/api/resources/${resource.id}/download`, courseLogin.cookie);
      assert.equal(downloadedNotes.status, 200, `${resource.title} should download for an enrolled student`);
      assert.match(downloadedNotes.contentType, /text\/plain/);
      assert.ok(downloadedNotes.bytes.length, `${resource.title} should not be empty`);
    }
    const unenrolledNotes = await requestBinary(server.baseUrl, "/api/resources/notes-java/download", registrationCookie);
    assert.equal(unenrolledNotes.status, 403);

    const javaEnrollment = await request(server.baseUrl, "/api/courses/c-8/enroll", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(javaEnrollment.status, 200);
    const startingCertificates = await request(server.baseUrl, "/api/certificates", { cookie: courseLogin.cookie });
    assert.ok(startingCertificates.result.some((certificate) => certificate.courseId === "c-8"
      && !certificate.eligible
      && certificate.learner === "Aarav Mehta"
      && certificate.totalModules === 4));
    const javaModules = courseModules.filter((module) => module.courseId === "c-8");
    const javaLesson = seededLearningContent.result.lessons.find((lesson) => lesson.id === "lesson-java-oop");
    assert.ok(javaLesson);
    const javaTopic = javaModules[0].topics[0];
    const earlyAssignment = await request(server.baseUrl, `/api/course-modules/${javaModules[0].id}/attempts`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: javaModules[0].assignment.questions.map((item) => item.answer) }
    });
    assert.equal(earlyAssignment.status, 409);
    const lockedTopic = await request(server.baseUrl, `/api/course-topics/${javaModules[1].topics[0].id}/complete`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(lockedTopic.status, 409);
    const lockedModule = await request(server.baseUrl, `/api/course-modules/${javaModules[1].id}/attempts`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: javaModules[1].assignment.questions.map((item) => item.answer) }
    });
    assert.equal(lockedModule.status, 409);
    const lockedLesson = await request(server.baseUrl, `/api/lessons/${javaLesson.id}/complete`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(lockedLesson.status, 409);
    for (const topic of javaModules[0].topics) {
      const completion = await request(server.baseUrl, `/api/course-topics/${topic.id}/complete`, {
        method: "POST",
        cookie: courseLogin.cookie,
        body: {}
      });
      assert.equal(completion.status, 200);
      assert.equal(completion.result.assignmentUnlocked, topic.id === javaModules[0].topics.at(-1).id);
    }
    const completedTopicLearning = await request(server.baseUrl, "/api/learning-content", { cookie: courseLogin.cookie });
    assert.ok(completedTopicLearning.result.modules.find((module) => module.id === javaModules[0].id).topics.every((topic) => topic.completed));
    const failedAssignment = await request(server.baseUrl, `/api/course-modules/${javaModules[0].id}/attempts`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: javaModules[0].assignment.questions.map((item) => (item.answer + 1) % item.options.length) }
    });
    assert.equal(failedAssignment.status, 201);
    assert.equal(failedAssignment.result.passed, false);
    const nextModuleAfterFailure = await request(server.baseUrl, `/api/course-modules/${javaModules[1].id}/attempts`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: javaModules[1].assignment.questions.map((item) => item.answer) }
    });
    assert.equal(nextModuleAfterFailure.status, 409);
    const passingAssignment = await request(server.baseUrl, `/api/course-modules/${javaModules[0].id}/attempts`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: javaModules[0].assignment.questions.map((item, index) => index === 0 ? (item.answer + 1) % item.options.length : item.answer) }
    });
    assert.equal(passingAssignment.status, 201);
    assert.equal(passingAssignment.result.passed, true);
    assert.equal(passingAssignment.result.percentage, 80);
    for (const module of javaModules.slice(1)) {
      for (const topic of module.topics) {
        const completion = await request(server.baseUrl, `/api/course-topics/${topic.id}/complete`, {
          method: "POST",
          cookie: courseLogin.cookie,
          body: {}
        });
        assert.equal(completion.status, 200);
      }
      const assignment = await request(server.baseUrl, `/api/course-modules/${module.id}/attempts`, {
        method: "POST",
        cookie: courseLogin.cookie,
        body: { answers: module.assignment.questions.map((item) => item.answer) }
      });
      assert.equal(assignment.status, 201);
      assert.equal(assignment.result.passed, true);
      assert.equal(assignment.result.percentage, 100);
    }
    const learningContent = await request(server.baseUrl, "/api/learning-content", { cookie: courseLogin.cookie });
    assert.ok(learningContent.result.modules.filter((module) => module.courseId === "c-8").every((module) => module.passed));
    const lessonCompletion = await request(server.baseUrl, `/api/lessons/${javaLesson.id}/complete`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(lessonCompletion.status, 200);
    assert.equal(lessonCompletion.result.completed, true);
    const quizAttempt = await request(server.baseUrl, "/api/quizzes/quiz-java/attempts", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { answers: [0, 1, 1] }
    });
    assert.equal(quizAttempt.status, 201);
    assert.equal(quizAttempt.result.percentage, 100);
    const secondJavaLesson = seededLearningContent.result.lessons.find((lesson) => lesson.courseId === "c-8" && lesson.id !== javaLesson.id);
    const secondLessonCompletion = await request(server.baseUrl, `/api/lessons/${secondJavaLesson.id}/complete`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(secondLessonCompletion.status, 200);
    const certificates = await request(server.baseUrl, "/api/certificates", { cookie: courseLogin.cookie });
    const javaCertificate = certificates.result.find((certificate) => certificate.courseId === "c-8");
    assert.ok(javaCertificate?.eligible && javaCertificate.certificateId);
    assert.equal(javaCertificate.learner, "Aarav Mehta");
    assert.equal(javaCertificate.course, "Java Programming & OOP");
    assert.equal(javaCertificate.completedLessons, javaCertificate.totalLessons);
    assert.equal(javaCertificate.passedModules, javaCertificate.totalModules);
    const certificatePdf = await requestBinary(server.baseUrl, "/api/certificates/c-8/pdf", courseLogin.cookie);
    assert.equal(certificatePdf.status, 200);
    assert.match(certificatePdf.contentType, /application\/pdf/);
    assert.equal(certificatePdf.bytes.subarray(0, 5).toString(), "%PDF-");
    assert.ok(certificatePdf.bytes.includes(Buffer.from("/MediaBox [0 0 841.89 595.28]")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("/Subtype /Image")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Zyngram completion verified seal")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from(javaCertificate.certificateId)));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Aarav Mehta")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Java Programming & OOP")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("CERTIFICATE OF COURSE COMPLETION")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Kasarla Jagan Kumar")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("CEO")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Founder")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Course Completion Certificate - Java Programming & OOP")));
    assert.ok(certificatePdf.bytes.includes(Buffer.from("Zyngram completion verified seal")));

    const incompleteCertificate = await requestBinary(server.baseUrl, "/api/certificates/c-1/pdf", courseLogin.cookie);
    assert.equal(incompleteCertificate.status, 409);

    const assistant = await request(server.baseUrl, "/api/ai/assistant", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { message: "Explain Java inheritance" }
    });
    assert.equal(assistant.status, 200);
    assert.equal(assistant.result.mode, "local");
    assert.match(assistant.result.answer, /subclass/i);

    const placementProgress = await request(server.baseUrl, "/api/careers/progress", {
      method: "PATCH",
      cookie: courseLogin.cookie,
      body: { progress: 65 }
    });
    assert.equal(placementProgress.result.placementProgress, 65);

    const newGroup = await request(server.baseUrl, "/api/community/groups", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { name: "Integration study circle", topic: "Software testing", schedule: "Fridays · 4 PM" }
    });
    assert.equal(newGroup.status, 201);
    assert.equal(newGroup.result.memberCount, 1);

    const discussion = await request(server.baseUrl, "/api/community/posts", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { title: "Integration question", body: "How do I test a REST endpoint?" }
    });
    assert.equal(discussion.status, 201);

    const roleMismatch = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: registration.result.email, password: "TestPass123", role: "administrator" }
    });
    assert.equal(roleMismatch.status, 403);
    assert.match(roleMismatch.result.error, /registered as Campus trainee/);
    assert.match(roleMismatch.result.error, /ask an administrator/i);

    const traineeCreateDenied = await request(server.baseUrl, "/api/modules", {
      method: "POST",
      cookie: registrationCookie,
      body: { title: "Forbidden module", category: "TEST", description: "Trainees cannot manage modules." }
    });
    assert.equal(traineeCreateDenied.status, 403);

    const profileUpdate = await request(server.baseUrl, "/api/profile", {
      method: "PATCH",
      cookie: registrationCookie,
      body: {
        name: "Integration Trainee Updated",
        title: "Software trainee",
        phone: "555-0100",
        skills: "JavaScript, React",
        bio: "Learning full-stack development."
      }
    });
    assert.equal(profileUpdate.status, 200);
    assert.equal(profileUpdate.result.user.skills, "JavaScript, React");

    const adminLogin = await setupStaffAccount(server.baseUrl, {
      email: "admin@zyngram.com", loginEmail: "admin@zyngram.demo", initialPassword: "admin123",
      role: "administrator", newPassword: "AdminPersonal123"
    });
    assert.ok(adminLogin.cookie);
    const adminOverview = await request(server.baseUrl, "/api/admin/overview", { cookie: adminLogin.cookie });
    assert.equal(adminOverview.status, 200);
    assert.ok(adminOverview.result.counts.students >= 1);
    assert.ok(Array.isArray(adminOverview.result.recentActivities));
    const studentCannotOpenAdminOverview = await request(server.baseUrl, "/api/admin/overview", { cookie: courseLogin.cookie });
    assert.equal(studentCannotOpenAdminOverview.status, 403);
    const adminSettings = await request(server.baseUrl, "/api/admin/settings", { cookie: adminLogin.cookie });
    assert.equal(adminSettings.status, 200);
    const updatedAdminSettings = await request(server.baseUrl, "/api/admin/settings", {
      method: "PATCH",
      cookie: adminLogin.cookie,
      body: { ...adminSettings.result, applicationName: "Zyngram Campus Hub Test", sessionHours: 8, minimumPasswordLength: 8 }
    });
    assert.equal(updatedAdminSettings.status, 200);
    const createdStaffEmail = `admin-created-${randomUUID()}@zyngram.com`;
    const createdStaff = await request(server.baseUrl, "/api/admin/users", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { name: "Admin Created Trainer", email: createdStaffEmail, role: "trainer", password: "InitialPass123" }
    });
    assert.equal(createdStaff.status, 201);
    assert.equal(createdStaff.result.user.mustChangePassword, true);
    const createdStaffLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: createdStaffEmail, password: "InitialPass123", role: "trainer" }
    });
    assert.equal(createdStaffLogin.status, 200);
    const deactivatedStaff = await request(server.baseUrl, `/api/admin/users/${createdStaff.result.user.id}/status`, {
      method: "PATCH", cookie: adminLogin.cookie, body: { active: false }
    });
    assert.equal(deactivatedStaff.status, 200);
    const deactivatedStaffLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: createdStaffEmail, password: "InitialPass123", role: "trainer" }
    });
    assert.equal(deactivatedStaffLogin.status, 403);
    const createdStaffSessionRevoked = await request(server.baseUrl, "/api/auth/me", { cookie: createdStaffLogin.cookie });
    assert.equal(createdStaffSessionRevoked.status, 401);
    await request(server.baseUrl, `/api/admin/users/${createdStaff.result.user.id}/status`, {
      method: "PATCH", cookie: adminLogin.cookie, body: { active: true }
    });
    const createdStaffRelogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: createdStaffEmail, password: "InitialPass123", role: "trainer" }
    });
    assert.equal(createdStaffRelogin.status, 200);
    const resetStaffPassword = await request(server.baseUrl, `/api/admin/users/${createdStaff.result.user.id}/reset-password`, {
      method: "POST", cookie: adminLogin.cookie, body: { password: "ResetPassword123" }
    });
    assert.equal(resetStaffPassword.status, 200);
    assert.equal((await request(server.baseUrl, "/api/auth/me", { cookie: createdStaffRelogin.cookie })).status, 401);
    const resetPasswordLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: createdStaffEmail, password: "ResetPassword123", role: "trainer" }
    });
    assert.equal(resetPasswordLogin.status, 200);
    assert.equal(resetPasswordLogin.result.user.mustChangePassword, true);
    const adminCourse = await request(server.baseUrl, "/api/admin/courses", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { title: `Admin course ${randomUUID()}`, category: "TEST", description: "Administrator-managed course.", trainerId: "u-trainer" }
    });
    assert.equal(adminCourse.status, 201);
    const archivedAdminCourse = await request(server.baseUrl, `/api/admin/courses/${adminCourse.result.id}`, {
      method: "PATCH",
      cookie: adminLogin.cookie,
      body: { title: adminCourse.result.title, category: adminCourse.result.category, description: adminCourse.result.description, status: "archived" }
    });
    assert.equal(archivedAdminCourse.status, 200);
    const adminAudit = await request(server.baseUrl, "/api/admin/audit-logs", { cookie: adminLogin.cookie });
    assert.ok(adminAudit.result.some((item) => item.action === "created_account" && item.targetId === createdStaff.result.user.id));
    const adminPermissions = await request(server.baseUrl, "/api/admin/permissions", { cookie: adminLogin.cookie });
    assert.equal(adminPermissions.status, 200);
    assert.ok(adminPermissions.result.some((item) => item.role === "administrator"));
    const adminCandidate = await request(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { name: "Administrator Candidate", password: "TestPass123", confirmPassword: "TestPass123" }
    });
    assert.equal(adminCandidate.status, 201);
    const adminCandidateLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: adminCandidate.result.email, password: "TestPass123", role: "student" }
    });
    assert.equal(adminCandidateLogin.status, 200);
    const grantAdministratorRole = await request(server.baseUrl, `/api/admin/users/${adminCandidateLogin.result.user.id}/role`, {
      method: "PATCH",
      cookie: adminLogin.cookie,
      body: { role: "administrator" }
    });
    assert.equal(grantAdministratorRole.status, 200);
    const promotedAccountLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: adminCandidate.result.email, password: "TestPass123", role: "administrator" }
    });
    assert.equal(promotedAccountLogin.status, 200);
    assert.equal(promotedAccountLogin.result.user.role, "administrator");
    assert.equal(promotedAccountLogin.result.user.mustChangePassword, true);
    const promotedPasswordChange = await request(server.baseUrl, "/api/auth/change-password", {
      method: "POST",
      cookie: promotedAccountLogin.cookie,
      body: { password: "PromotedAdmin123", confirmPassword: "PromotedAdmin123" }
    });
    assert.equal(promotedPasswordChange.status, 200);
    const aiStatus = await request(server.baseUrl, "/api/ai/status", { cookie: adminLogin.cookie });
    assert.equal(aiStatus.result.mode, "local");

    const anonymousAttendanceMark = await request(server.baseUrl, "/api/attendance/mark", {
      method: "POST",
      body: { studentId: "u-student", courseId: "c-1", date: new Date().toISOString().slice(0, 10), status: "late" }
    });
    assert.equal(anonymousAttendanceMark.status, 401);

    const attendanceMark = await request(server.baseUrl, "/api/attendance/mark", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { studentId: "u-student", courseId: "c-1", date: new Date().toISOString().slice(0, 10), status: "late" }
    });
    assert.equal(attendanceMark.status, 200, `${JSON.stringify(attendanceMark.result)}\n${server.getOutput()}`);
    assert.equal(attendanceMark.result.status, "late");

    const trainerLogin = await setupStaffAccount(server.baseUrl, {
      email: "trainer@zyngram.com", loginEmail: "trainer@zyngram.demo", initialPassword: "teach123",
      role: "trainer", newPassword: "TrainerPersonal123"
    });
    const trainerOverview = await request(server.baseUrl, "/api/trainer/overview", { cookie: trainerLogin.cookie });
    assert.equal(trainerOverview.status, 200);
    assert.match(trainerOverview.result.trainerId, /^TRN-/);
    assert.ok(trainerOverview.result.batches.some((batch) => batch.id === "batch-software-2026"));
    const roleTargetedAnnouncement = await request(server.baseUrl, "/api/announcements", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { title: "Trainer operations update", body: "This note is for trainers only.", selectedRoles: ["trainer"] }
    });
    assert.equal(roleTargetedAnnouncement.status, 201);
    const trainerAnnouncements = await request(server.baseUrl, "/api/announcements", { cookie: trainerLogin.cookie });
    assert.ok(trainerAnnouncements.result.some((item) => item.id === roleTargetedAnnouncement.result.id));
    const studentAnnouncements = await request(server.baseUrl, "/api/announcements", { cookie: courseLogin.cookie });
    assert.ok(!studentAnnouncements.result.some((item) => item.id === roleTargetedAnnouncement.result.id));
    const trainerCourseCreate = await request(server.baseUrl, "/api/courses", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: {
        title: "Trainer-created API course",
        category: "TESTING",
        description: "A course created by a trainer for integration coverage.",
        schedule: "Friday · 10:00 AM"
      }
    });
    assert.equal(trainerCourseCreate.status, 201);
    assert.equal(trainerCourseCreate.result.trainerId, "u-trainer");
    const trainerCourseList = await request(server.baseUrl, "/api/courses", { cookie: trainerLogin.cookie });
    assert.ok(trainerCourseList.result.some((course) => course.id === trainerCourseCreate.result.id));
    const courseMaterial = await request(server.baseUrl, "/api/resources", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: {
        courseId: trainerCourseCreate.result.id,
        title: "Course starter notes",
        type: "notes",
        content: "Trainer-created study notes for course participants."
      }
    });
    assert.equal(courseMaterial.status, 201);
    const unassignedCourseMaterial = await request(server.baseUrl, `/api/resources/${courseMaterial.result.id}/download`, { cookie: courseLogin.cookie });
    assert.equal(unassignedCourseMaterial.status, 403);
    const studentCourseEnrollment = await request(server.baseUrl, `/api/courses/${trainerCourseCreate.result.id}/enroll`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: {}
    });
    assert.equal(studentCourseEnrollment.status, 200, JSON.stringify({ result: studentCourseEnrollment.result, course: trainerCourseCreate.result }));
    const enrolledCourseMaterial = await requestBinary(server.baseUrl, `/api/resources/${courseMaterial.result.id}/download`, courseLogin.cookie);
    assert.equal(enrolledCourseMaterial.status, 200, enrolledCourseMaterial.bytes.toString());
    assert.match(enrolledCourseMaterial.contentType, /^text\/plain/);
    assert.match(enrolledCourseMaterial.bytes.toString(), /study notes/);
    const courseAnnouncement = await request(server.baseUrl, "/api/announcements", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: { title: "Course update", body: "The first class is ready.", courseId: trainerCourseCreate.result.id }
    });
    assert.equal(courseAnnouncement.status, 201);
    const visibleCourseAnnouncements = await request(server.baseUrl, "/api/announcements", { cookie: courseLogin.cookie });
    assert.ok(visibleCourseAnnouncements.result.some((item) => item.id === courseAnnouncement.result.id));
    const trainerClass = await request(server.baseUrl, "/api/timetable", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: {
        title: "Trainer-created class",
        courseId: trainerCourseCreate.result.id,
        day: "Friday",
        startTime: "10:00",
        endTime: "11:00",
        room: "Studio 5"
      }
    });
    assert.equal(trainerClass.status, 201);
    const trainerClassUpdate = await request(server.baseUrl, `/api/timetable/${trainerClass.result.id}`, {
      method: "PATCH",
      cookie: trainerLogin.cookie,
      body: {
        title: "Updated trainer class",
        courseId: trainerCourseCreate.result.id,
        day: "Friday",
        startTime: "11:00",
        endTime: "12:00",
        room: "Studio 6"
      }
    });
    assert.equal(trainerClassUpdate.status, 200);
    assert.equal(trainerClassUpdate.result.title, "Updated trainer class");
    const createdCourseAssignment = await request(server.baseUrl, "/api/assignments", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: {
        title: "Trainer course assessment",
        courseId: trainerCourseCreate.result.id,
        detail: "Complete and submit the course assessment.",
        due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        points: 50
      }
    });
    assert.equal(createdCourseAssignment.status, 201);
    const trainerAssignmentSubmission = await request(server.baseUrl, `/api/assignments/${createdCourseAssignment.result.id}/submissions`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { text: "Assessment completed." }
    });
    assert.equal(trainerAssignmentSubmission.status, 201);
    const trainerAssignmentList = await request(server.baseUrl, "/api/assignments", { cookie: trainerLogin.cookie });
    const trainerAssessment = trainerAssignmentList.result.find((item) => item.id === createdCourseAssignment.result.id);
    assert.equal(trainerAssessment.submissions.length, 1);
    assert.equal(trainerAssessment.submissions[0].student, "Aarav Mehta");
    const trainerAssignmentReview = await request(server.baseUrl, `/api/assignments/submissions/${trainerAssignmentSubmission.result.submission.id}/review`, {
      method: "PATCH",
      cookie: trainerLogin.cookie,
      body: { marks: 45, feedback: "Clear and complete." }
    });
    assert.equal(trainerAssignmentReview.status, 200);
    const trainerAttendanceRecord = await request(server.baseUrl, "/api/attendance/mark", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: {
        studentId: "u-student",
        courseId: trainerCourseCreate.result.id,
        date: new Date().toISOString().slice(0, 10),
        status: "present"
      }
    });
    assert.equal(trainerAttendanceRecord.status, 200);
    const refreshedTrainerOverview = await request(server.baseUrl, "/api/trainer/overview", { cookie: trainerLogin.cookie });
    assert.ok(refreshedTrainerOverview.result.students.some((student) => student.id === "u-student" && student.assignmentsReviewed === 1));
    const studentCourseCreateDenied = await request(server.baseUrl, "/api/courses", {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { title: "Student course", category: "TEST", description: "Students cannot create trainer courses." }
    });
    assert.equal(studentCourseCreateDenied.status, 403);
    const seededCapstoneSubmission = await request(server.baseUrl, `/api/assignments/${capstone.id}/submissions`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { link: "https://example.test/campus-connect", text: "Completed all six capstone milestones." }
    });
    assert.equal(seededCapstoneSubmission.status, 201);
    const trainerAssignments = await request(server.baseUrl, "/api/assignments", { cookie: trainerLogin.cookie });
    assert.ok(trainerAssignments.result.some((assignment) => assignment.id === capstone.id
      && assignment.submission?.student === "Aarav Mehta"));
    const capstoneReview = await request(server.baseUrl, `/api/assignments/submissions/${seededCapstoneSubmission.result.submission.id}/review`, {
      method: "PATCH",
      cookie: trainerLogin.cookie,
      body: { marks: 180, feedback: "All project milestones are complete." }
    });
    assert.equal(capstoneReview.status, 200);
    assert.equal(capstoneReview.result.marks, 180);

    const assignmentCreate = await request(server.baseUrl, "/api/assignments", {
      method: "POST",
      cookie: trainerLogin.cookie,
      body: { title: "Integration project", courseId: "c-1", detail: "Share your finished project.", due: "2099-12-31", points: 50 }
    });
    assert.equal(assignmentCreate.status, 201);
    const assignmentId = assignmentCreate.result.id;
    const assignmentSubmission = await request(server.baseUrl, `/api/assignments/${assignmentId}/submissions`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { link: "https://example.test/project" }
    });
    assert.equal(assignmentSubmission.status, 201);
    const assignmentReview = await request(server.baseUrl, `/api/assignments/submissions/${assignmentSubmission.result.submission.id}/review`, {
      method: "PATCH",
      cookie: trainerLogin.cookie,
      body: { marks: 48, feedback: "Clear structure and a thoughtful project." }
    });
    assert.equal(assignmentReview.status, 200);
    assert.equal(assignmentReview.result.status, "reviewed");
    const resubmitGradedAssignment = await request(server.baseUrl, `/api/assignments/${assignmentId}/submissions`, {
      method: "POST",
      cookie: courseLogin.cookie,
      body: { text: "Attempt to replace graded work." }
    });
    assert.equal(resubmitGradedAssignment.status, 409);

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const pastEvent = await request(server.baseUrl, "/api/events", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { title: "Past campus workshop", description: "This event should not be published.", date: yesterday.toISOString().slice(0, 10), startTime: "10:30", location: "Test Lab", category: "Workshop", capacity: 1 }
    });
    assert.equal(pastEvent.status, 400);

    const eventCreate = await request(server.baseUrl, "/api/events", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { title: "Integration campus workshop", description: "A test event with limited registration.", date: "2099-10-20", startTime: "10:30", location: "Test Lab", category: "Workshop", capacity: 1 }
    });
    assert.equal(eventCreate.status, 201);
    const eventRegistration = await request(server.baseUrl, `/api/events/${eventCreate.result.id}/register`, {
      method: "POST", cookie: courseLogin.cookie, body: {}
    });
    assert.equal(eventRegistration.status, 200);
    assert.equal(eventRegistration.result.registrationCount, 1);
    const duplicateEventRegistration = await request(server.baseUrl, `/api/events/${eventCreate.result.id}/register`, {
      method: "POST", cookie: courseLogin.cookie, body: {}
    });
    assert.equal(duplicateEventRegistration.status, 200);
    assert.equal(duplicateEventRegistration.result.registrationCount, 1);
    const registeredEvents = await request(server.baseUrl, "/api/events", { cookie: courseLogin.cookie });
    assert.equal(registeredEvents.result.find((event) => event.id === eventCreate.result.id).registered, true);
    assert.equal(registeredEvents.result.find((event) => event.id === eventCreate.result.id).registrationCount, 1);
    const eventAtCapacity = await request(server.baseUrl, `/api/events/${eventCreate.result.id}/register`, {
      method: "POST", cookie: registrationCookie, body: {}
    });
    assert.equal(eventAtCapacity.status, 409);
    const eventCancellation = await request(server.baseUrl, `/api/events/${eventCreate.result.id}`, {
      method: "DELETE", cookie: adminLogin.cookie
    });
    assert.equal(eventCancellation.status, 200);

    const batchCreate = await request(server.baseUrl, "/api/batches", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { name: `Integration cohort ${randomUUID()}`, courseId: "c-4", trainerId: "u-trainer", capacity: 1, startDate: "2099-10-20" }
    });
    assert.equal(batchCreate.status, 201);
    const studentCannotSeeBatchAllocation = await request(server.baseUrl, "/api/batches", { cookie: courseLogin.cookie });
    assert.equal(studentCannotSeeBatchAllocation.status, 403);
    const batchAllocation = await request(server.baseUrl, `/api/batches/${batchCreate.result.id}/learners`, {
      method: "POST", cookie: adminLogin.cookie, body: { learnerId: registeredUserId }
    });
    assert.equal(batchAllocation.status, 201);
    const allocatedCourses = await request(server.baseUrl, "/api/courses", { cookie: registrationCookie });
    assert.equal(allocatedCourses.result.find((course) => course.id === "c-4").enrolled, true);
    const batchAtCapacity = await request(server.baseUrl, `/api/batches/${batchCreate.result.id}/learners`, {
      method: "POST", cookie: adminLogin.cookie, body: { learnerId: "u-student" }
    });
    assert.equal(batchAtCapacity.status, 409);
    const assignedBatches = await request(server.baseUrl, "/api/batches", { cookie: adminLogin.cookie });
    assert.ok(assignedBatches.result.some((batch) => batch.id === batchCreate.result.id && batch.learners.length === 1));
    const trainerBatches = await request(server.baseUrl, "/api/batches", { cookie: trainerLogin.cookie });
    assert.ok(trainerBatches.result.some((batch) => batch.id === batchCreate.result.id));

    const coordinatorLogin = await setupStaffAccount(server.baseUrl, {
      email: "coordinator@zyngram.com", loginEmail: "coordinator@zyngram.demo", initialPassword: "campus123",
      role: "coordinator", newPassword: "CoordinatorPersonal123"
    });
    const coordinatorProfile = await request(server.baseUrl, "/api/auth/me", { cookie: coordinatorLogin.cookie });
    assert.match(coordinatorProfile.result.user.coordinatorId, /^COO-/);
    const coordinatorOverview = await request(server.baseUrl, "/api/coordinator/overview", { cookie: coordinatorLogin.cookie });
    assert.equal(coordinatorOverview.status, 200);
    assert.ok(coordinatorOverview.result.counts.students >= 2);
    assert.ok(coordinatorOverview.result.counts.trainers >= 1);
    const coordinatorStudents = await request(server.baseUrl, "/api/coordinator/students", { cookie: coordinatorLogin.cookie });
    assert.ok(coordinatorStudents.result.some((student) => student.id === registeredUserId && student.zinId));
    const coordinatorTrainers = await request(server.baseUrl, "/api/coordinator/trainers", { cookie: coordinatorLogin.cookie });
    assert.ok(coordinatorTrainers.result.some((trainer) => trainer.id === "u-trainer" && trainer.trainerId.startsWith("TRN-")));
    const coordinatorCannotChangeRoles = await request(server.baseUrl, "/api/admin/users", { cookie: coordinatorLogin.cookie });
    assert.equal(coordinatorCannotChangeRoles.status, 403);
    const coordinatorCannotEditAttendance = await request(server.baseUrl, "/api/attendance/mark", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { studentId: registeredUserId, courseId: "c-4", date: new Date().toISOString().slice(0, 10), status: "absent" }
    });
    assert.equal(coordinatorCannotEditAttendance.status, 403);
    const coordinatorCannotCreateAssignments = await request(server.baseUrl, "/api/assignments", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { title: "Unauthorized assignment", courseId: "c-4", detail: "Coordinator should monitor only.", due: "2099-10-20", points: 20 }
    });
    assert.equal(coordinatorCannotCreateAssignments.status, 403);
    const coordinatorCannotGrade = await request(server.baseUrl, `/api/assignments/submissions/${trainerAssignmentSubmission.result.submission.id}/review`, {
      method: "PATCH",
      cookie: coordinatorLogin.cookie,
      body: { marks: 10, feedback: "This review must stay trainer-only." }
    });
    assert.equal(coordinatorCannotGrade.status, 403);
    const coordinatorAssignmentMonitor = await request(server.baseUrl, "/api/assignments", { cookie: coordinatorLogin.cookie });
    assert.ok(coordinatorAssignmentMonitor.result.some((assignment) => assignment.pendingLearners?.length));

    const coordinatorBatch = await request(server.baseUrl, "/api/batches", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { name: `Coordinator cohort ${randomUUID()}`, courseId: "c-4", trainerId: "u-trainer", capacity: 2, startDate: "2099-10-20" }
    });
    assert.equal(coordinatorBatch.status, 201);
    const studentBatchMove = await request(server.baseUrl, `/api/batches/${coordinatorBatch.result.id}/learners`, {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { learnerId: registeredUserId }
    });
    assert.equal(studentBatchMove.status, 201);
    const batchesAfterMove = await request(server.baseUrl, "/api/batches", { cookie: coordinatorLogin.cookie });
    assert.equal(batchesAfterMove.result.find((batch) => batch.id === batchCreate.result.id).learners.length, 0);
    const batchUpdate = await request(server.baseUrl, `/api/batches/${coordinatorBatch.result.id}`, {
      method: "PATCH",
      cookie: coordinatorLogin.cookie,
      body: {
        name: coordinatorBatch.result.name,
        courseId: "c-4",
        trainerId: "u-trainer",
        capacity: 2,
        startDate: "2099-10-20",
        endDate: "2099-12-31",
        status: "active"
      }
    });
    assert.equal(batchUpdate.status, 200);
    assert.equal(batchUpdate.result.status, "active");

    const batchAnnouncement = await request(server.baseUrl, "/api/announcements", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { title: "Batch schedule note", body: "The lab opens at ten.", batchId: coordinatorBatch.result.id }
    });
    assert.equal(batchAnnouncement.status, 201);
    assert.equal("recipientIds" in batchAnnouncement.result, false);
    const visibleBatchAnnouncement = await request(server.baseUrl, "/api/announcements", { cookie: registrationCookie });
    assert.ok(visibleBatchAnnouncement.result.some((item) => item.id === batchAnnouncement.result.id));
    const hiddenBatchAnnouncement = await request(server.baseUrl, "/api/announcements", { cookie: courseLogin.cookie });
    assert.ok(!hiddenBatchAnnouncement.result.some((item) => item.id === batchAnnouncement.result.id));

    const studentRequest = await request(server.baseUrl, "/api/support", {
      method: "POST",
      cookie: registrationCookie,
      body: { subject: "Please move my cohort", category: "batch_change", message: "I was placed into the wrong cohort." }
    });
    assert.equal(studentRequest.status, 201);
    const coordinatorRequests = await request(server.baseUrl, "/api/support", { cookie: coordinatorLogin.cookie });
    assert.ok(coordinatorRequests.result.some((ticket) => ticket.id === studentRequest.result.id && ticket.user));
    const resolvedRequest = await request(server.baseUrl, `/api/support/${studentRequest.result.id}/status`, {
      method: "PATCH",
      cookie: coordinatorLogin.cookie,
      body: { status: "resolved", response: "Your batch allocation has been reviewed." }
    });
    assert.equal(resolvedRequest.status, 200);
    const requesterView = await request(server.baseUrl, "/api/support", { cookie: registrationCookie });
    assert.equal(requesterView.result.find((ticket) => ticket.id === studentRequest.result.id).response, "Your batch allocation has been reviewed.");

    const coordinatorClass = await request(server.baseUrl, "/api/timetable", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: {
        title: "Coordinator scheduled class",
        courseId: "c-4",
        day: "Sunday",
        startTime: "23:00",
        endTime: "23:30",
        trainer: "Mira Sharma",
        trainerId: "u-trainer",
        room: `Room-${randomUUID()}`,
        batchId: coordinatorBatch.result.id,
        meetingUrl: "https://meet.example.com/campus"
      }
    });
    assert.equal(coordinatorClass.status, 201);
    const classConflict = await request(server.baseUrl, "/api/timetable", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: {
        title: "Conflicting class",
        courseId: "c-4",
        day: "Sunday",
        startTime: "23:10",
        endTime: "23:40",
        trainer: "Mira Sharma",
        trainerId: "u-trainer",
        room: `Other-${randomUUID()}`
      }
    });
    assert.equal(classConflict.status, 409);
    const trainerClassNotice = await request(server.baseUrl, "/api/notifications", { cookie: trainerLogin.cookie });
    assert.ok(trainerClassNotice.result.some((item) => item.title === "Class scheduled: Coordinator scheduled class"));

    const coordinatorEvent = await request(server.baseUrl, "/api/events", {
      method: "POST",
      cookie: coordinatorLogin.cookie,
      body: { title: "Coordinator campus event", description: "An event for editing coverage.", date: "2099-10-20", startTime: "10:00", location: "Main hall", category: "Workshop", capacity: 10 }
    });
    assert.equal(coordinatorEvent.status, 201);
    const registeredForCoordinatorEvent = await request(server.baseUrl, `/api/events/${coordinatorEvent.result.id}/register`, {
      method: "POST", cookie: courseLogin.cookie, body: {}
    });
    assert.equal(registeredForCoordinatorEvent.status, 200);
    const coordinatorEventUpdate = await request(server.baseUrl, `/api/events/${coordinatorEvent.result.id}`, {
      method: "PATCH",
      cookie: coordinatorLogin.cookie,
      body: { title: "Updated campus event", description: "Updated details.", date: "2099-10-21", startTime: "11:00", location: "Learning hall", category: "Showcase", capacity: 1 }
    });
    assert.equal(coordinatorEventUpdate.status, 200);
    assert.equal(coordinatorEventUpdate.result.registrationCount, 1);

    const placementLogin = await setupStaffAccount(server.baseUrl, {
      email: "placement@zyngram.com", loginEmail: "placement@zyngram.demo", initialPassword: "career123",
      role: "placement_officer", newPassword: "PlacementPersonal123"
    });
    const placementJobs = await request(server.baseUrl, "/api/careers", { cookie: placementLogin.cookie });
    assert.ok(placementJobs.result.jobs.length > 0);
    const placementOverview = await request(server.baseUrl, "/api/placement/officer/overview", { cookie: placementLogin.cookie });
    assert.equal(placementOverview.status, 200);
    assert.match(placementOverview.result.officerId, /^PO-/);
    assert.ok(placementOverview.result.counts.students >= 2);
    const studentCannotReadPlacementCompanies = await request(server.baseUrl, "/api/placement/companies", { cookie: registrationCookie });
    assert.equal(studentCannotReadPlacementCompanies.status, 403);
    const placementProfileSave = await request(server.baseUrl, "/api/placement/profile", {
      method: "PATCH",
      cookie: registrationCookie,
      body: { skills: ["JavaScript", "React", "SQL"], cgpa: 8.6, graduationYear: 2027, courseId: "c-1" }
    });
    assert.equal(placementProfileSave.status, 200);
    assert.equal(placementProfileSave.result.eligibility, "eligible");
    const placementStudentProfiles = await request(server.baseUrl, "/api/placement/students?skill=react&eligibility=eligible", { cookie: placementLogin.cookie });
    assert.ok(placementStudentProfiles.result.some((student) => student.id === registeredUserId));
    const placementResume = await requestBinary(server.baseUrl, `/api/placement/students/${registeredUserId}/resume`, placementLogin.cookie);
    assert.equal(placementResume.status, 200);
    assert.match(placementResume.contentType, /^application\/pdf/);
    const companyCreate = await request(server.baseUrl, "/api/placement/companies", {
      method: "POST",
      cookie: placementLogin.cookie,
      body: { name: `Integration Recruiter ${randomUUID()}`, industry: "Software", website: "https://example.test", recruiterName: "Recruiter", recruiterEmail: "recruiter@example.test" }
    });
    assert.equal(companyCreate.status, 201);
    const companyUpdate = await request(server.baseUrl, `/api/placement/companies/${companyCreate.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie,
      body: { ...companyCreate.result, recruiterName: "Updated recruiter", notes: "Partner hiring history." }
    });
    assert.equal(companyUpdate.status, 200);
    assert.equal(companyUpdate.result.recruiterName, "Updated recruiter");
    const today = new Date().toISOString().slice(0, 10);
    const futureDay = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const placementJob = await request(server.baseUrl, "/api/placement/jobs", {
      method: "POST",
      cookie: placementLogin.cookie,
      body: { companyId: companyCreate.result.id, title: "Integration React Engineer", description: "Build student-facing interfaces.", skills: ["React"], minCgpa: 7, location: "Hyderabad", workMode: "Hybrid", deadline: futureDay(30), positions: 3, type: "Full time", status: "published" }
    });
    assert.equal(placementJob.status, 201);
    const placementJobUpdate = await request(server.baseUrl, `/api/placement/jobs/${placementJob.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie,
      body: { ...placementJob.result, title: "Updated Integration React Engineer" }
    });
    assert.equal(placementJobUpdate.status, 200);
    assert.equal(placementJobUpdate.result.title, "Updated Integration React Engineer");
    const placementDrive = await request(server.baseUrl, "/api/placement/drives", {
      method: "POST",
      cookie: placementLogin.cookie,
      body: { companyId: companyCreate.result.id, jobId: placementJob.result.id, roleTitle: "React Drive", registrationStart: today, registrationEnd: futureDay(30), driveDate: futureDay(45), venue: "Online", selectionProcess: ["Technical", "HR"], minCgpa: 7, status: "published" }
    });
    assert.equal(placementDrive.status, 201);
    const placementDriveUpdate = await request(server.baseUrl, `/api/placement/drives/${placementDrive.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie,
      body: { ...placementDrive.result, venue: "Updated online venue" }
    });
    assert.equal(placementDriveUpdate.status, 200);
    assert.equal(placementDriveUpdate.result.venue, "Updated online venue");
    const studentOpportunities = await request(server.baseUrl, "/api/placement/opportunities", { cookie: registrationCookie });
    assert.ok(studentOpportunities.result.jobs.some((job) => job.id === placementJob.result.id));
    assert.ok(studentOpportunities.result.drives.some((drive) => drive.id === placementDrive.result.id));
    const placementApplication = await request(server.baseUrl, "/api/placement/applications", {
      method: "POST", cookie: registrationCookie, body: { jobId: placementJob.result.id }
    });
    assert.equal(placementApplication.status, 201);
    const duplicatePlacementApplication = await request(server.baseUrl, "/api/placement/applications", {
      method: "POST", cookie: registrationCookie, body: { jobId: placementJob.result.id }
    });
    assert.equal(duplicatePlacementApplication.status, 409);
    const placementDriveApplication = await request(server.baseUrl, "/api/placement/applications", {
      method: "POST", cookie: registrationCookie, body: { driveId: placementDrive.result.id }
    });
    assert.equal(placementDriveApplication.status, 201);
    const shortlisted = await request(server.baseUrl, `/api/placement/applications/${placementApplication.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie, body: { status: "shortlisted", reason: "Profile meets the role requirements." }
    });
    assert.equal(shortlisted.status, 200);
    const placementInterview = await request(server.baseUrl, "/api/placement/interviews", {
      method: "POST", cookie: placementLogin.cookie,
      body: { applicationId: placementApplication.result.id, scheduledAt: new Date(Date.now() + 5 * 86400000).toISOString(), roundType: "Technical", venue: "Online", meetingLink: "https://example.test/interview" }
    });
    assert.equal(placementInterview.status, 201);
    const interviewAttendance = await request(server.baseUrl, `/api/placement/interviews/${placementInterview.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie, body: { status: "attended" }
    });
    assert.equal(interviewAttendance.status, 200);
    const offerCreate = await request(server.baseUrl, "/api/placement/offers", {
      method: "POST", cookie: placementLogin.cookie, body: { applicationId: placementApplication.result.id, packageText: "Verified test offer", joiningDate: futureDay(60) }
    });
    assert.equal(offerCreate.status, 201);
    const offerAccepted = await request(server.baseUrl, `/api/placement/offers/${offerCreate.result.id}`, {
      method: "PATCH", cookie: placementLogin.cookie, body: { status: "accepted" }
    });
    assert.equal(offerAccepted.status, 200);
    const placementReports = await request(server.baseUrl, "/api/placement/reports", { cookie: placementLogin.cookie });
    assert.equal(placementReports.status, 200);
    assert.ok(placementReports.result.placedStudents >= 1);
    const studentCannotRecordPlacementOutcome = await request(server.baseUrl, `/api/placement/applications/${placementApplication.result.id}`, {
      method: "PATCH", cookie: registrationCookie, body: { status: "selected" }
    });
    assert.equal(studentCannotRecordPlacementOutcome.status, 403);

    const moduleCreate = await request(server.baseUrl, "/api/modules", {
      method: "POST",
      cookie: adminLogin.cookie,
      body: { title: "Integration module", category: "TEST", description: "Temporary persistence test module." }
    });
    assert.equal(moduleCreate.status, 201);
    const moduleId = moduleCreate.result.id;

    const traineeEditDenied = await request(server.baseUrl, `/api/modules/${moduleId}`, {
      method: "PATCH",
      cookie: registrationCookie,
      body: { title: "Unauthorized edit", category: "TEST", description: "Must be forbidden." }
    });
    assert.equal(traineeEditDenied.status, 403);

    const moduleUpdate = await request(server.baseUrl, `/api/modules/${moduleId}`, {
      method: "PATCH",
      cookie: adminLogin.cookie,
      body: { title: "Integration module updated", category: "TEST", description: "Update persisted." }
    });
    assert.equal(moduleUpdate.status, 200);

    const secondStudentLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: secondNamedStudent.result.email, password: "TestPass123", role: "student" }
    });
    const secondStudentProfile = await request(server.baseUrl, "/api/auth/me", { cookie: secondStudentLogin.cookie });
    const secondStudentUserId = secondStudentProfile.result.user.id;
    const previousZinId = "IN320460764549IH";
    await client.db(temporaryDatabase).collection("users").updateOne(
      { _id: secondStudentUserId },
      { $set: { zinId: previousZinId, email: `${previousZinId.toLowerCase()}@zyngram.com` }, $unset: { zinName: "", loginAliases: "" } }
    );
    await stopServer(server.child);
    server = await startServer(port);

    const previousIdLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: previousZinId, password: "TestPass123", role: "student" }
    });
    assert.equal(previousIdLogin.status, 200);
    assert.match(previousIdLogin.result.user.zinId, /^KI\d{12}AN$/);

    const relogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: registration.result.email, password: "TestPass123", role: "student" }
    });
    assert.equal(relogin.status, 200);

    const persistedProfile = await request(server.baseUrl, "/api/auth/me", { cookie: relogin.cookie });
    assert.equal(persistedProfile.result.user.name, "Integration Trainee Updated");
    assert.equal(persistedProfile.result.user.phone, "555-0100");
    assert.equal(persistedProfile.result.user.resumeFileName, "resume.pdf");
    assert.equal(persistedProfile.result.user.avatarUrl, "/api/profile/assets/avatar");

    const persistedModules = await request(server.baseUrl, "/api/modules", { cookie: relogin.cookie });
    assert.ok(persistedModules.result.some((module) => module.id === moduleId && module.title === "Integration module updated"));

    const deleteDenied = await request(server.baseUrl, `/api/modules/${moduleId}`, {
      method: "DELETE",
      cookie: relogin.cookie
    });
    assert.equal(deleteDenied.status, 403);

    const adminRelogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@zyngram.com", password: "AdminPersonal123", role: "administrator" }
    });
    const moduleDelete = await request(server.baseUrl, `/api/modules/${moduleId}`, {
      method: "DELETE",
      cookie: adminRelogin.cookie
    });
    assert.equal(moduleDelete.status, 200);

    mockAI = await startMockAIProvider();
    await stopServer(server.child);
    server = await startServer(port, {
      AI_BASE_URL: mockAI.baseUrl,
      AI_API_KEY: "integration-test-only",
      AI_MODEL: "integration-model"
    });
    const providerLogin = await request(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: registration.result.email, password: "TestPass123", role: "student" }
    });
    assert.equal(providerLogin.status, 200);
    const providerStatus = await request(server.baseUrl, "/api/ai/status", { cookie: providerLogin.cookie });
    assert.equal(providerStatus.result.mode, "provider");
    assert.deepEqual(providerStatus.result.missing, []);
    const providerAnswer = await request(server.baseUrl, "/api/ai/assistant", {
      method: "POST",
      cookie: providerLogin.cookie,
      body: { message: "Explain arrays" }
    });
    assert.equal(providerAnswer.status, 200);
    assert.equal(providerAnswer.result.mode, "provider");
    assert.equal(providerAnswer.result.answer, "Mock AI provider response for integration testing.");
    assert.equal(mockAI.requests[0].authorization, "Bearer integration-test-only");
    assert.equal(mockAI.requests[0].body.model, "integration-model");

    t.diagnostic("Verified administrator security and lifecycle, placement profiles, company/job/drive CRUD, applications, interviews, offers, reports, resume privacy, trainer workflows, coordinator authorization, and persistence.");
  } finally {
    if (server) await stopServer(server.child);
    if (mockAI) await stopHttpServer(mockAI.server);
    await client.db(temporaryDatabase).dropDatabase();
    await client.close();
    await rm(temporaryDataPath, { force: true });
  }
});