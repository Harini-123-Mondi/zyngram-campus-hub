export const safeText = (value, max = 1000) => typeof value === "string"
  && value.trim().length > 0
  && value.trim().length <= max;

export function isZinEmail(email) {
  return typeof email === "string" && /^[A-Z]{2}\d{12}[A-Z]{2}@zyngram\.com$/i.test(email.trim());
}

export function isZinId(zinId) {
  return typeof zinId === "string" && /^[A-Z]{2}\d{12}[A-Z]{2}$/i.test(zinId.trim());
}

export function isAllowedRequestOrigin(origin, host, isProduction) {
  if (!origin) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (parsedOrigin.host === host) return true;
  return !isProduction
    && parsedOrigin.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname);
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128
    || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must be at least 8 characters (up to 128), including at least one letter and one number.";
  }
  return null;
}

export function validateRegistration({ name, password, confirmPassword } = {}) {
  if (!safeText(name, 80)) return "Enter your full name (up to 80 characters).";
  const passwordError = validatePassword(password);
  if (passwordError) return passwordError;
  if (password !== confirmPassword) return "The passwords do not match. Enter the same password in both fields.";
  return null;
}
