import assert from "node:assert/strict";
import test from "node:test";
import { experienceFeatures, getExperienceFeature, validateExperienceFields } from "./experience-features.js";

test("the campus experience catalog contains 30 uniquely identified tools", () => {
  assert.equal(experienceFeatures.length, 30);
  assert.equal(new Set(experienceFeatures.map((feature) => feature.id)).size, 30);
  for (const feature of experienceFeatures) {
    assert.ok(feature.title);
    assert.ok(feature.description);
    assert.ok(feature.fields.some((field) => field.id === "title"));
    assert.ok(feature.viewRoles.length);
    assert.ok(feature.createRoles.length);
  }
});

test("experience fields enforce required values, enumerations, and field allowlists", () => {
  const feature = getExperienceFeature("job-application-tracker");
  assert.equal(validateExperienceFields(feature, { title: "Frontend Engineer" }).error, "Role is required.");
  assert.match(validateExperienceFields(feature, {
    title: "Frontend Engineer",
    role: "Engineer",
    status: "Sent"
  }).error, /valid option/);
  assert.match(validateExperienceFields(feature, {
    title: "Frontend Engineer",
    role: "Engineer",
    appliedOn: "2026-03-08",
    status: "Applied",
    unexpected: "not allowed"
  }).error, /unsupported field/);

  const result = validateExperienceFields(feature, {
    title: "Frontend Engineer",
    role: "Engineer",
    appliedOn: "2026-03-08",
    status: "Applied",
    notes: "Follow up next week"
  });
  assert.deepEqual(result.fields, {
    title: "Frontend Engineer",
    role: "Engineer",
    appliedOn: "2026-03-08",
    status: "Applied",
    notes: "Follow up next week"
  });
});

test("experience fields reject invalid dates, non-HTTPS links, and out-of-range numbers", () => {
  assert.match(validateExperienceFields(getExperienceFeature("learning-streaks"), {
    title: "Daily practice",
    minutes: 25,
    activityDate: "2026-02-31"
  }).error, /valid date/);
  assert.match(validateExperienceFields(getExperienceFeature("digital-portfolio"), {
    title: "My project",
    itemType: "Project",
    link: "http://example.com"
  }).error, /HTTPS URL/);
  assert.match(validateExperienceFields(getExperienceFeature("placement-readiness"), {
    title: "Placement prep",
    skillsScore: 120
  }).error, /number from 0 to 100/);
});

test("lead management is restricted to placement officers and administrators", () => {
  const feature = getExperienceFeature("lead-management");
  assert.deepEqual(feature.createRoles, ["placement_officer", "administrator"]);
  assert.deepEqual(feature.viewRoles, ["placement_officer", "administrator"]);
  assert.match(validateExperienceFields(feature, {
    title: "Website enquiry",
    email: "not-an-email",
    status: "New enquiry"
  }).error, /valid email address/);
});
