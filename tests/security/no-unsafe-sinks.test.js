import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const required = [
  "site/js/app.js",
  "site/js/core/mock-engine.js",
  "site/js/core/route-matcher.js",
  "site/js/core/middleware.js",
  "site/js/core/response-builder.js",
  "site/js/core/router.js",
  "site/js/core/logger.js",
  "site/js/services/storage-service.js",
  "site/js/services/endpoint-service.js",
  "site/js/services/collection-service.js",
  "site/js/services/import-export-service.js",
  "site/js/modules/dashboard.js",
  "site/js/modules/endpoints.js",
  "site/js/modules/endpoint-form.js",
  "site/js/modules/collections.js",
  "site/js/modules/tester.js",
  "site/js/modules/logs.js",
  "site/js/modules/docs.js",
  "site/js/utils/validation.js",
  "site/js/utils/json.js",
  "site/js/utils/dom.js",
  "site/js/utils/id.js",
  "site/js/utils/time.js",
];

function javascriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...javascriptFiles(path));
    else if (path.endsWith(".js")) files.push(path);
  }
  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("site javascript does not use unsafe sinks", () => {
  for (const path of required) statSync(path);
  const forbidden = [
    /\binnerHTML\b/,
    /\bouterHTML\b/,
    /\binsertAdjacentHTML\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\bdocument\.write\b/,
    /\bfetch\s*\(/,
  ];
  for (const path of javascriptFiles("site/js")) {
    const source = stripComments(readFileSync(path, "utf8"));
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${path} matches ${pattern}`);
    }
  }
});
