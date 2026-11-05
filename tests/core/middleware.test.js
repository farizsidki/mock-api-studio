import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkAuthentication,
  parseJsonBody,
  validateRequest,
} from "../../site/js/core/middleware.js";

function endpoint(auth, handler = { type: "static" }) {
  return { auth, handler };
}

test("disabled auth allows a request", () => {
  const result = checkAuthentication({
    endpoint: endpoint({ enabled: false, type: "bearer", headerName: "Authorization", expectedValue: "" }),
    headers: {},
  });
  assert.deepEqual(result, { ok: true });
});

test("bearer and api key checks are exact and header names are case-insensitive", () => {
  const bearer = endpoint({
    enabled: true,
    type: "bearer",
    headerName: "Authorization",
    expectedValue: "demo-token",
  });
  assert.equal(checkAuthentication({
    endpoint: bearer,
    headers: { authorization: "Bearer demo-token" },
  }).ok, true);
  const rejected = checkAuthentication({
    endpoint: bearer,
    headers: { Authorization: "bearer demo-token" },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "UNAUTHORIZED");
  assert.equal(JSON.stringify(rejected).includes("demo-token"), false);

  const apiKey = endpoint({
    enabled: true,
    type: "apiKey",
    headerName: "X-API-Key",
    expectedValue: "secret",
  });
  assert.equal(checkAuthentication({
    endpoint: apiKey,
    headers: { "x-api-key": "secret" },
  }).ok, true);
  assert.equal(checkAuthentication({
    endpoint: apiKey,
    headers: { "X-API-Key": "Secret" },
  }).ok, false);
});

test("json body parsing treats blank text as absent", () => {
  assert.equal(parseJsonBody("").value, undefined);
  assert.equal(parseJsonBody("  ").value, undefined);
  assert.deepEqual(parseJsonBody("{\"a\":1}").value, { a: 1 });
  assert.equal(parseJsonBody("{").ok, false);
  assert.equal(parseJsonBody("{").error.code, "BAD_JSON");
});

test("collection writes require an object body and static requests do not", () => {
  const create = endpoint(null, { type: "collection", operation: "create" });
  assert.equal(validateRequest({ endpoint: create, body: undefined, query: new URLSearchParams() }).ok, false);
  assert.equal(validateRequest({ endpoint: create, body: [], query: new URLSearchParams() }).error.code, "VALIDATION_ERROR");
  assert.equal(validateRequest({ endpoint: create, body: { name: "Sam" }, query: new URLSearchParams() }).ok, true);
  const list = endpoint(null, { type: "static" });
  assert.equal(validateRequest({ endpoint: list, body: [], query: new URLSearchParams() }).ok, true);
});
