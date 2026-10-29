export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !["/auth/login", "/auth/register"].includes(path)) {
      window.dispatchEvent(new CustomEvent("campus-session-expired", { detail: { message: result.error } }));
    }
    const error = new Error(result.error || "We couldn't complete that request.");
    error.status = response.status;
    throw error;
  }
  return result;
}
