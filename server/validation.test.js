import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRequestOrigin, isZinEmail, isZinId, safeText, validateRegistration } from "./validation.js";

test("safeText accepts trimmed text within the limit", () => {
  assert.equal(safeText("  Zyngram  ", 20), true);
  assert.equal(safeText(" ", 20), false);
  assert.equal(safeText("too long", 3), false);
  assert.equal(safeText(12, 20), false);
});

test("student registration requires a name and matching strong password", () => {
  assert.equal(validateRegistration({
    name: "Aarav Mehta",
    password: "learn1234",
    confirmPassword: "learn1234"
  }), null);
  assert.match(validateRegistration({
    name: "",
    password: "learn1234",
    confirmPassword: "learn1234"
  }), /full name/);
  assert.match(validateRegistration({
    name: "Aarav Mehta",
    password: "password",
    confirmPassword: "password"
  }), /at least 8 characters/);
  assert.match(validateRegistration({
    name: "Aarav Mehta",
    password: "learn1234",
    confirmPassword: "different123"
  }), /passwords do not match/);
  assert.equal(isZinId("HA123456789012NI"), true);
  assert.equal(isZinId("IN921034042957IH"), true);
  assert.equal(isZinEmail("HA123456789012NI@zyngram.com"), true);
  assert.equal(isZinEmail("student@gmail.com"), false);
});

test("request origins allow same-origin requests and local development ports only", () => {
  assert.equal(isAllowedRequestOrigin(undefined, "localhost:4000", false), true);
  assert.equal(isAllowedRequestOrigin("http://localhost:4000", "localhost:4000", true), true);
  assert.equal(isAllowedRequestOrigin("http://localhost:5176", "localhost:4000", false), true);
  assert.equal(isAllowedRequestOrigin("http://127.0.0.1:5174", "localhost:4000", false), true);
  assert.equal(isAllowedRequestOrigin("http://localhost:5176", "localhost:4000", true), false);
  assert.equal(isAllowedRequestOrigin("https://localhost:5176", "localhost:4000", false), false);
  assert.equal(isAllowedRequestOrigin("http://localhost.attacker.test:5176", "localhost:4000", false), false);
  assert.equal(isAllowedRequestOrigin("not a URL", "localhost:4000", false), false);
});