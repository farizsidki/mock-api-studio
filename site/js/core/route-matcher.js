const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function normalizePathname(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  if (pathname.includes("?") || pathname.includes("#") || pathname.includes("\\") || /\s/.test(pathname)) {
    return null;
  }
  let path = pathname;
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function inspectPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized) return { ok: false };
  if (normalized === "/") return { ok: true, path: "/", segments: [] };
  const segments = normalized.split("/").slice(1);
  if (segments.some((segment) => segment.length === 0)) return { ok: false };
  const names = new Set();
  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const name = segment.slice(1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || names.has(name)) return { ok: false };
      names.add(name);
      continue;
    }
    if (segment === "." || segment === ".." || !/^[A-Za-z0-9._~-]+$/.test(segment)) return { ok: false };
  }
  return { ok: true, path: normalized, segments };
}

export function routesConflict(pathA, pathB) {
  const left = inspectPath(pathA);
  const right = inspectPath(pathB);
  if (!left.ok || !right.ok || left.segments.length !== right.segments.length) return false;
  let specLeft = 0;
  let specRight = 0;
  for (let index = 0; index < left.segments.length; index += 1) {
    const a = left.segments[index];
    const b = right.segments[index];
    const aParam = a.startsWith(":");
    const bParam = b.startsWith(":");
    if (!aParam && !bParam) {
      if (a !== b) return false;
      specLeft += 1;
      specRight += 1;
    } else if (!aParam) specLeft += 1;
    else if (!bParam) specRight += 1;
  }
  return specLeft === specRight;
}

function decodeRequestPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized) return { ok: false };
  if (normalized === "/") return { ok: true, segments: [] };
  const rawSegments = normalized.split("/").slice(1);
  if (rawSegments.some((segment) => segment.length === 0)) return { ok: false };
  const segments = [];
  for (const raw of rawSegments) {
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return { ok: false };
    }
    if (decoded === "." || decoded === "..") return { ok: false };
    segments.push(decoded);
  }
  return { ok: true, segments };
}

export function matchRoute({ method, pathname, endpoints }) {
  const empty = { match: null, pathMatched: false, allowedMethods: [], routeParams: {}, error: null };
  const decoded = decodeRequestPath(pathname);
  if (!decoded.ok) return { ...empty, error: "BAD_ENCODING" };

  const candidates = [];
  for (const endpoint of endpoints) {
    if (!endpoint?.enabled) continue;
    const inspected = inspectPath(endpoint.path);
    if (!inspected.ok || inspected.segments.length !== decoded.segments.length) continue;
    const params = {};
    let staticCount = 0;
    let matched = true;
    for (let index = 0; index < inspected.segments.length; index += 1) {
      const pattern = inspected.segments[index];
      const actual = decoded.segments[index];
      if (pattern.startsWith(":")) params[pattern.slice(1)] = actual;
      else if (pattern === actual) staticCount += 1;
      else {
        matched = false;
        break;
      }
    }
    if (matched) {
      candidates.push({
        endpoint,
        params,
        staticCount,
        exact: staticCount === inspected.segments.length,
      });
    }
  }

  const allowedMethods = METHODS.filter((name) => candidates.some((item) => item.endpoint.method === name));
  const sameMethod = candidates.filter((item) => item.endpoint.method === method);
  if (sameMethod.length === 0) {
    return {
      match: null,
      pathMatched: candidates.length > 0,
      allowedMethods: candidates.length > 0 ? allowedMethods : [],
      routeParams: {},
      error: null,
    };
  }

  const best = Math.max(...sameMethod.map((item) => item.staticCount));
  const top = sameMethod.filter((item) => item.staticCount === best);
  if (top.length > 1) {
    return {
      match: null,
      pathMatched: true,
      allowedMethods,
      routeParams: {},
      error: "AMBIGUOUS_ROUTE",
    };
  }
  return {
    match: top[0].endpoint,
    pathMatched: true,
    allowedMethods,
    routeParams: top[0].params,
    error: null,
  };
}
