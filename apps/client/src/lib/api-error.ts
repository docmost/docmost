import { isAxiosError } from "axios";

export function getApiErrorMessage(
  error: unknown,
  fallback = "An error occurred",
): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) {
      const joined = message.filter(Boolean).join(", ");
      if (joined) return joined;
    } else if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}
