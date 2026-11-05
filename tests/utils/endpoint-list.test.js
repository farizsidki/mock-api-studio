import assert from "node:assert/strict";
import { test } from "node:test";
import { filterEndpoints } from "../../site/js/utils/endpoint-list.js";

test("filter matches name or path and can hide disabled endpoints", () => {
  const endpoints = [
    { name: "List Users", method: "GET", path: "/users", enabled: true },
    { name: "Create", method: "POST", path: "/users", enabled: false },
  ];
  const found = filterEndpoints(endpoints, { query: "USERS", enabled: "enabled", sort: "path-asc" });
  assert.deepEqual(found.map((item) => item.name), ["List Users"]);
  found[0].name = "Changed";
  assert.equal(endpoints[0].name, "List Users");
});
