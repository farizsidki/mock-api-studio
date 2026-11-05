import { cloneData } from "../utils/json.js";

const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  422: "Unprocessable Content",
  500: "Internal Server Error",
};

export function buildResponse({ status, headers, body, error, metadata }) {
  const safeError = error ? { code: error.code, message: error.message } : null;
  return {
    ok: safeError === null && status >= 200 && status < 300,
    status,
    statusText: STATUS_TEXT[status] ?? "",
    headers: cloneData(headers ?? {}),
    body: cloneData(body),
    elapsedMs: metadata.elapsedMs,
    matchedEndpointId: metadata.matchedEndpointId ?? null,
    routeParams: cloneData(metadata.routeParams ?? {}),
    error: safeError,
  };
}
