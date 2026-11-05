import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRoute } from "../../site/js/core/route-matcher.js";

function endpoint(overrides) {
  return {
    id: "ep_1",
    method: "GET",
    path: "/users",
    enabled: true,
    ...overrides,
  };
}

test("exact path matches and query is not part of the path", () => {
  const result = matchRoute({
    method: "GET",
    pathname: "/users",
    endpoints: [endpoint()],
  });
  assert.equal(result.match.id, "ep_1");
  assert.deepEqual(result.routeParams, {});
  assert.equal(result.pathMatched, true);
  assert.equal(result.error, null);
});

test("dynamic parameter is captured and trailing slash is ignored", () => {
  const endpoints = [endpoint({ path: "/users/:id" })];
  const result = matchRoute({ method: "GET", pathname: "/users/42/", endpoints });
  assert.equal(result.match.id, "ep_1");
  assert.deepEqual(result.routeParams, { id: "42" });
});

test("exact route beats a dynamic route", () => {
  const endpoints = [
    endpoint({ id: "dynamic", path: "/users/:id" }),
    endpoint({ id: "exact", path: "/users/new" }),
  ];
  const result = matchRoute({ method: "GET", pathname: "/users/new", endpoints });
  assert.equal(result.match.id, "exact");
});

test("method mismatch reports allowed methods and a missing path does not", () => {
  const endpoints = [
    endpoint({ method: "POST", enabled: true }),
    endpoint({ id: "off", method: "DELETE", enabled: false }),
  ];
  const mismatch = matchRoute({ method: "GET", pathname: "/users", endpoints });
  assert.equal(mismatch.match, null);
  assert.equal(mismatch.pathMatched, true);
  assert.deepEqual(mismatch.allowedMethods, ["POST"]);
  const missing = matchRoute({ method: "GET", pathname: "/missing", endpoints });
  assert.equal(missing.pathMatched, false);
  const disabled = matchRoute({
    method: "GET",
    pathname: "/users",
    endpoints: [endpoint({ enabled: false })],
  });
  assert.equal(disabled.pathMatched, false);
});

test("invalid encoding and dot segments are rejected", () => {
  const endpoints = [endpoint({ path: "/users/:id" })];
  assert.equal(matchRoute({ method: "GET", pathname: "/users/%", endpoints }).error, "BAD_ENCODING");
  assert.equal(matchRoute({ method: "GET", pathname: "/users/%2e%2e", endpoints }).error, "BAD_ENCODING");
});

test("equally specific dynamic routes are ambiguous", () => {
  const endpoints = [
    endpoint({ id: "a", path: "/users/:id" }),
    endpoint({ id: "b", path: "/users/:userId" }),
  ];
  const result = matchRoute({ method: "GET", pathname: "/users/1", endpoints });
  assert.equal(result.error, "AMBIGUOUS_ROUTE");
  assert.equal(result.match, null);
});

test("path matching is case sensitive", () => {
  const result = matchRoute({
    method: "GET",
    pathname: "/Users",
    endpoints: [endpoint({ path: "/users" })],
  });
  assert.equal(result.match, null);
  assert.equal(result.pathMatched, false);
});
