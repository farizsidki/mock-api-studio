import assert from "node:assert/strict";
import { test } from "node:test";
import { buildResponse } from "../../site/js/core/response-builder.js";

test("success response uses the shared contract and clones data", () => {
  const headers = { "Content-Type": "application/json" };
  const body = { data: [] };
  const response = buildResponse({
    status: 201,
    headers,
    body,
    error: null,
    metadata: { elapsedMs: 5, matchedEndpointId: "ep_1", routeParams: { id: "1" } },
  });
  headers["Content-Type"] = "text/plain";
  body.data.push(1);
  assert.equal(response.ok, true);
  assert.equal(response.status, 201);
  assert.equal(response.statusText, "Created");
  assert.equal(response.headers["Content-Type"], "application/json");
  assert.deepEqual(response.body, { data: [] });
  assert.equal(response.error, null);
  assert.equal(response.elapsedMs, 5);
  assert.deepEqual(response.routeParams, { id: "1" });
});

test("non-2xx static status is not ok and unknown status text is empty", () => {
  const response = buildResponse({
    status: 418,
    headers: {},
    body: { tea: true },
    error: null,
    metadata: { elapsedMs: 0, matchedEndpointId: "ep_1", routeParams: {} },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error, null);
  assert.equal(response.statusText, "");
  assert.deepEqual(response.body, { tea: true });
});

test("engine error keeps a null body", () => {
  const response = buildResponse({
    status: 404,
    headers: { "Content-Type": "application/json" },
    body: null,
    error: { code: "ROUTE_NOT_FOUND", message: "No matching endpoint" },
    metadata: { elapsedMs: 1, matchedEndpointId: null, routeParams: {} },
  });
  assert.equal(response.ok, false);
  assert.equal(response.body, null);
  assert.equal(response.statusText, "Not Found");
  assert.equal(response.error.code, "ROUTE_NOT_FOUND");
});
