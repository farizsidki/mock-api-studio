export function filterEndpoints(endpoints, options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const method = options.method || "";
  const enabled = options.enabled || "all";
  const sort = options.sort || "name-asc";
  const filtered = endpoints.filter((endpoint) => {
    if (method && endpoint.method !== method) return false;
    if (enabled === "enabled" && endpoint.enabled !== true) return false;
    if (enabled === "disabled" && endpoint.enabled !== false) return false;
    if (!query) return true;
    const name = String(endpoint.name || "").toLowerCase();
    const path = String(endpoint.path || "").toLowerCase();
    return name.includes(query) || path.includes(query);
  });
  const copy = filtered.map((endpoint) => ({ ...endpoint }));
  copy.sort((left, right) => {
    if (sort === "name-desc") return right.name.localeCompare(left.name);
    if (sort === "path-asc") return left.path.localeCompare(right.path) || left.name.localeCompare(right.name);
    return left.name.localeCompare(right.name);
  });
  return copy;
}
