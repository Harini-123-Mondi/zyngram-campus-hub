export const managedApiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const managedApiEnvironments = ["development", "staging", "production"];

export const initialManagedApis = [
  {
    id: "api-health",
    name: "Health check",
    description: "Reports API and database connectivity.",
    module: "Platform",
    baseUrl: "/api",
    endpointPath: "/health",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: false,
    status: "active"
  },
  {
    id: "api-auth-login",
    name: "Sign in",
    description: "Creates a signed-in Campus Hub session.",
    module: "Authentication",
    baseUrl: "/api",
    endpointPath: "/auth/login",
    method: "POST",
    version: "v1",
    environment: "development",
    authRequired: false,
    status: "active"
  },
  {
    id: "api-auth-register",
    name: "Student registration",
    description: "Creates a student account and personalized ZIN credentials.",
    module: "Authentication",
    baseUrl: "/api",
    endpointPath: "/auth/register",
    method: "POST",
    version: "v1",
    environment: "development",
    authRequired: false,
    status: "active"
  },
  {
    id: "api-auth-me",
    name: "Current account",
    description: "Returns the current signed-in account.",
    module: "Authentication",
    baseUrl: "/api",
    endpointPath: "/auth/me",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-dashboard",
    name: "Campus dashboard",
    description: "Returns role-scoped dashboard and learning summary data.",
    module: "Dashboard",
    baseUrl: "/api",
    endpointPath: "/dashboard",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-modules-list",
    name: "Learning modules",
    description: "Lists Campus Hub learning modules.",
    module: "Learning",
    baseUrl: "/api",
    endpointPath: "/modules",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-courses-list",
    name: "Course catalog",
    description: "Lists the Campus Hub courses available to the signed-in user.",
    module: "Learning",
    baseUrl: "/api",
    endpointPath: "/courses",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-attendance-list",
    name: "Attendance records",
    description: "Returns attendance information scoped to the signed-in user's role.",
    module: "Attendance",
    baseUrl: "/api",
    endpointPath: "/attendance",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-events-list",
    name: "Campus events",
    description: "Lists upcoming Campus Hub events and registration details.",
    module: "Campus Events",
    baseUrl: "/api",
    endpointPath: "/events",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-notifications-list",
    name: "Notifications",
    description: "Lists notifications visible to the signed-in account.",
    module: "Notifications",
    baseUrl: "/api",
    endpointPath: "/notifications",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-placement-opportunities",
    name: "Placement opportunities",
    description: "Lists placement opportunities available to signed-in students.",
    module: "Placement",
    baseUrl: "/api",
    endpointPath: "/placement/opportunities",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-admin-overview",
    name: "Administrator overview",
    description: "Returns counts and recent activity for administrators.",
    module: "Administration",
    baseUrl: "/api",
    endpointPath: "/admin/overview",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-admin-users",
    name: "Administrator user directory",
    description: "Lists campus accounts for authorized administrators.",
    module: "Administration",
    baseUrl: "/api",
    endpointPath: "/admin/users",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active"
  },
  {
    id: "api-demo-secure-profile",
    name: "Protected demo profile",
    description: "Demonstration endpoint protected by a consumer API key.",
    module: "API Management Demo",
    baseUrl: "/api",
    endpointPath: "/demo/secure/profile",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active",
    isMock: true
  },
  {
    id: "api-demo-secure-modules",
    name: "Protected demo modules",
    description: "Demonstration endpoint protected by a consumer API key.",
    module: "API Management Demo",
    baseUrl: "/api",
    endpointPath: "/demo/secure/modules",
    method: "GET",
    version: "v1",
    environment: "development",
    authRequired: true,
    status: "active",
    isMock: true
  }
];

const isSafePath = (value) => typeof value === "string"
  && value.startsWith("/")
  && value.length <= 180
  && !value.includes("..")
  && !/[?#\s]/.test(value)
  && /^\/[A-Za-z0-9_/:.-]*$/.test(value);

export function validateManagedApi(input) {
  const identifier = typeof input?.id === "string" ? input.id.trim() : "";
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const module = typeof input?.module === "string" ? input.module.trim() : "";
  const baseUrl = typeof input?.baseUrl === "string" ? input.baseUrl.trim() : "";
  const endpointPath = typeof input?.endpointPath === "string" ? input.endpointPath.trim() : "";
  const method = typeof input?.method === "string" ? input.method.toUpperCase() : "";
  const version = typeof input?.version === "string" ? input.version.trim() : "";
  const environment = input?.environment;

  if (!/^[a-z][a-z0-9_-]{2,63}$/.test(identifier)) return "Use a unique identifier with 3–64 lowercase letters, numbers, hyphens, or underscores.";
  if (!name || name.length > 100 || !description || description.length > 600
    || !module || module.length > 100 || !version || version.length > 32) {
    return "Enter a name, description, owning module, and version within the allowed lengths.";
  }
  if (!(baseUrl === "/api" || /^https?:\/\/[^/\s?#]+(?:\/[A-Za-z0-9/_-]*)?$/.test(baseUrl))) {
    return "Base URL must be /api or a valid HTTP(S) URL without query parameters.";
  }
  if (!isSafePath(endpointPath)) return "Enter a valid endpoint path beginning with / and without query parameters.";
  if (!managedApiMethods.includes(method)) return "Choose a supported HTTP method.";
  if (!managedApiEnvironments.includes(environment)) return "Choose a supported environment.";
  if (typeof input.authRequired !== "boolean") return "Choose whether authentication is required.";
  if (!["active", "archived"].includes(input.status)) return "Choose active or archived status.";

  return null;
}

export function validateManagedConsumer(input, apiIds) {
  const identifier = typeof input?.id === "string" ? input.id.trim() : "";
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const allowedApiIds = Array.isArray(input?.allowedApiIds) ? [...new Set(input.allowedApiIds)] : null;
  const allowedMethods = Array.isArray(input?.allowedMethods)
    ? [...new Set(input.allowedMethods.map((method) => typeof method === "string" ? method.toUpperCase() : ""))]
    : null;
  const rateLimit = Number(input?.rateLimit);

  if (!/^[a-z][a-z0-9_-]{2,63}$/.test(identifier)) return "Use a unique consumer identifier with 3–64 lowercase letters, numbers, hyphens, or underscores.";
  if (!name || name.length > 100 || description.length > 600) return "Enter a consumer name and a description within the allowed length.";
  if (!allowedApiIds || allowedApiIds.length === 0
    || allowedApiIds.some((id) => typeof id !== "string" || !apiIds.has(id))) {
    return "Select APIs that exist in the registry.";
  }
  if (!allowedMethods || allowedMethods.length === 0 || allowedMethods.some((method) => !managedApiMethods.includes(method))) {
    return "Select at least one valid HTTP method.";
  }
  if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 10000) {
    return "Rate limit must be a whole number from 1 to 10,000 requests per minute.";
  }
  if (!["active", "suspended", "revoked"].includes(input.status)) return "Choose active, suspended, or revoked status.";

  return null;
}

export const toOpenApiPath = (endpointPath) => endpointPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
