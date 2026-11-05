import { cloneData } from "../utils/json.js";
import {
  IMPORT_MAX_BYTES,
  createDomainError,
  isDomainError,
  validateImportDocument,
} from "../utils/validation.js";

function mergeById(current, incoming) {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

function mergeWorkspaces(current, incoming) {
  return {
    schemaVersion: 1,
    endpoints: mergeById(current.endpoints, incoming.endpoints),
    collections: mergeById(current.collections, incoming.collections),
    presets: mergeById(current.presets || [], incoming.presets || []),
  };
}

export function createImportExportService({ storageService, validator = validateImportDocument, clock }) {
  let parsed = null;

  function parseImport(text) {
    if (typeof text !== "string") {
      throw createDomainError({ code: "IMPORT_INVALID", message: "Import must be text", status: 422 });
    }
    if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) {
      throw createDomainError({
        code: "IMPORT_TOO_LARGE",
        message: "Import file is too large",
        status: 422,
      });
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw createDomainError({
        code: "IMPORT_INVALID",
        message: "Import file is not valid JSON",
        status: 422,
      });
    }
    const workspace = validator(data);
    parsed = { text, workspace };
    return workspace;
  }

  return {
    exportWorkspace() {
      const workspace = storageService.loadWorkspace();
      return {
        app: "mock-api-studio",
        schemaVersion: 1,
        exportedAt: new Date(clock()).toISOString(),
        endpoints: cloneData(workspace.endpoints),
        collections: cloneData(workspace.collections),
        presets: cloneData(workspace.presets),
      };
    },
    validateImport(text) {
      try {
        const workspace = parseImport(text);
        return {
          ok: true,
          summary: {
            endpoints: workspace.endpoints.length,
            collections: workspace.collections.length,
            presets: workspace.presets.length,
          },
        };
      } catch (error) {
        if (!isDomainError(error)) {
          return { ok: false, errors: [{ code: "IMPORT_INVALID", message: "Import failed" }] };
        }
        return { ok: false, errors: [{ code: error.code, message: error.message }] };
      }
    },
    importWorkspace(text, options = {}) {
      if (options.strategy !== "replace" && options.strategy !== "merge") {
        throw createDomainError({
          code: "IMPORT_INVALID",
          message: "Only replace strategy is supported",
          status: 422,
        });
      }
      const incoming = parsed && parsed.text === text ? parsed.workspace : parseImport(text);
      parsed = null;
      const workspace = options.strategy === "merge" ? mergeWorkspaces(storageService.loadWorkspace(), incoming) : incoming;
      try {
        storageService.saveWorkspace(workspace);
      } catch (error) {
        if (isDomainError(error) && error.code !== "STORAGE_WRITE_FAILED" && error.code !== "STORAGE_UNAVAILABLE") {
          throw createDomainError({ code: "IMPORT_INVALID", message: error.message, status: 422 });
        }
        throw error;
      }
      return {
        endpoints: workspace.endpoints.length,
        collections: workspace.collections.length,
      };
    },
  };
}
