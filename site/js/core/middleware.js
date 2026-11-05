import { isPlainObject } from "../utils/json.js";

function headerValue(headers, name) {
  if (!isPlainObject(headers) || typeof name !== "string") return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

export function checkAuthentication({ endpoint, headers }) {
  const auth = endpoint?.auth;
  if (!auth || auth.enabled !== true) return { ok: true };
  const expected = auth.type === "bearer" ? `Bearer ${auth.expectedValue}` : auth.expectedValue;
  if ((auth.type === "bearer" || auth.type === "apiKey") && headerValue(headers, auth.headerName) === expected) {
    return { ok: true };
  }
  return { ok: false, error: { code: "UNAUTHORIZED", message: "Authentication failed" } };
}

export function parseJsonBody(bodyText) {
  if (bodyText == null) return { ok: true, value: undefined };
  if (typeof bodyText !== "string") {
    return { ok: false, error: { code: "BAD_JSON", message: "Request body must be a string" } };
  }
  if (bodyText.trim() === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(bodyText) };
  } catch {
    return { ok: false, error: { code: "BAD_JSON", message: "Malformed JSON body" } };
  }
}

function matchesType(value, type) {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isPlainObject(value);
  return false;
}

function ruleError(message) {
  return { ok: false, error: { code: "VALIDATION_ERROR", message } };
}

export function validateRequest({ endpoint, body }) {
  const operation = endpoint?.handler?.type === "collection" ? endpoint.handler.operation : null;
  const writes = operation === "create" || operation === "replace" || operation === "update";
  if (writes && !isPlainObject(body)) {
    return ruleError("JSON object body is required");
  }
  for (const rule of endpoint?.bodyRules || []) {
    const present = isPlainObject(body) && Object.hasOwn(body, rule.field);
    if (!present) {
      if (rule.required) return ruleError(`Field ${rule.field} is required`);
      continue;
    }
    if (!matchesType(body[rule.field], rule.type)) {
      return ruleError(`Field ${rule.field} must be a ${rule.type}`);
    }
  }
  return { ok: true };
}
