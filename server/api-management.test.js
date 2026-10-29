import assert from "node:assert/strict";
import test from "node:test";
import {
  managedApiEnvironments, managedApiMethods, toOpenApiPath,
  validateManagedApi, validateManagedConsumer
} from "./api-management.js";

const validApi = {
  id: "api-example",
  name: "Example endpoint",
  description: "Returns a sample result.",
  module: "Examples",
  baseUrl: "/api",
  endpointPath: "/examples/:exampleId",
  method: "GET",
  version: "v1",
  environment: "development",
  authRequired: true,
  status: "active"
};
const validConsumer = {
  id: "partner-app",
  name: "Partner application",
  description: "Campus integration.",
  allowedApiIds: ["api-example"],
  allowedMethods: ["GET"],
  rateLimit: 60,
  status: "active"
};

test("managed API validation accepts supported records and rejects unsafe paths", () => {
  assert.equal(validateManagedApi(validApi), null);
  assert.match(validateManagedApi({ ...validApi, endpointPath: "/users/../private" }), /valid endpoint path/);
  assert.match(validateManagedApi({ ...validApi, method: "TRACE" }), /supported HTTP method/);
  assert.match(validateManagedApi({ ...validApi, environment: "local" }), /supported environment/);
  assert.deepEqual(managedApiMethods, ["GET", "POST", "PUT", "PATCH", "DELETE"]);
  assert.deepEqual(managedApiEnvironments, ["development", "staging", "production"]);
});

test("managed consumer validation requires known APIs, methods, and bounded limits", () => {
  const knownApis = new Set(["api-example"]);
  assert.equal(validateManagedConsumer(validConsumer, knownApis), null);
  assert.match(validateManagedConsumer({ ...validConsumer, allowedApiIds: [] }, knownApis), /Select APIs/);
  assert.match(validateManagedConsumer({ ...validConsumer, allowedApiIds: ["missing-api"] }, knownApis), /Select APIs/);
  assert.match(validateManagedConsumer({ ...validConsumer, allowedMethods: ["TRACE"] }, knownApis), /HTTP method/);
  assert.match(validateManagedConsumer({ ...validConsumer, rateLimit: 10001 }, knownApis), /Rate limit/);
});

test("OpenAPI path conversion preserves parameters", () => {
  assert.equal(toOpenApiPath("/users/:userId/courses/:courseId"), "/users/{userId}/courses/{courseId}");
});