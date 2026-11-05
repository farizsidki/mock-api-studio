export function findHistoryEntry(entries, id) {
  if (!id) return null;
  return entries.find((entry) => entry.id === id) ?? null;
}

export function createRequestHistory({ maxEntries = 20 } = {}) {
  const entries = [];
  let nextId = 1;
  return {
    add(request) {
      const headers = {};
      for (const [key, value] of Object.entries(request.headers || {})) headers[key] = String(value);
      entries.push({
        id: `req_${nextId++}`,
        method: request.method,
        url: request.url,
        headers,
        bodyText: request.bodyText ?? "",
      });
      while (entries.length > maxEntries) entries.shift();
    },
    list() {
      return entries.slice().reverse().map((entry) => ({
        id: entry.id,
        method: entry.method,
        url: entry.url,
        headers: { ...entry.headers },
        bodyText: entry.bodyText,
      }));
    },
    clear() {
      entries.length = 0;
    },
  };
}
