export function createLogger({ maxEntries = 200, clock }) {
  const entries = [];
  return {
    add(entry) {
      entries.push({
        timestamp: new Date(clock()).toISOString(),
        method: entry.method,
        path: entry.path,
        status: entry.status,
        elapsedMs: entry.elapsedMs,
        matchedEndpointId: entry.matchedEndpointId ?? null,
      });
      while (entries.length > maxEntries) entries.shift();
    },
    list(filters = {}) {
      return entries
        .filter((entry) => {
          if (filters.method !== undefined && entry.method !== filters.method) return false;
          if (filters.status !== undefined && entry.status !== filters.status) return false;
          return true;
        })
        .map((entry) => ({ ...entry }));
    },
    clear() {
      entries.length = 0;
    },
    exportLogs(format) {
      const rows = this.list();
      if (format === "json") return JSON.stringify(rows, null, 2);
      if (format === "text") {
        return rows.map((row) => `${row.timestamp} ${row.method} ${row.path} ${row.status} ${row.elapsedMs}ms`).join("\n");
      }
      throw new Error("Unknown log format");
    },
  };
}
