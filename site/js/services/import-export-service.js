import { cloneData } from "../utils/json.js";
import {
  IMPORT_MAX_BYTES,
  createDomainError,
  isDomainError,
  validateImportDocument,
} from "../utils/validation.js";

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
      if (options.strategy !== "replace") {
        throw createDomainError({
          code: "IMPORT_INVALID",
          message: "Only replace strategy is supported",
          status: 422,
        });
      }
      const workspace = parsed && parsed.text === text ? parsed.workspace : parseImport(text);
      parsed = null;
      storageService.saveWorkspace(workspace);
      return {
        endpoints: workspace.endpoints.length,
        collections: workspace.collections.length,
      };
    },
  };
}
