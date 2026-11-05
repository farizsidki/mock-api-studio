import { cloneData } from "../utils/json.js";
import {
  createDomainError,
  isDomainError,
  validateStoredWorkspace,
} from "../utils/validation.js";

export function createStorageService({ storage, key }) {
  const stamps = new WeakMap();
  let cache = null;

  function emptyWorkspace() {
    return { schemaVersion: 1, endpoints: [], collections: [], presets: [] };
  }

  function readRaw() {
    try {
      return storage.getItem(key);
    } catch {
      throw createDomainError({
        code: "STORAGE_UNAVAILABLE",
        message: "Browser storage is unavailable",
        status: 500,
      });
    }
  }

  function remember(workspace, raw) {
    stamps.set(workspace, raw);
    return workspace;
  }

  return {
    loadWorkspace() {
      const raw = readRaw();
      if (raw == null) return remember(emptyWorkspace(), null);
      if (cache && cache.raw === raw) return remember(cloneData(cache.workspace), raw);
      try {
        const workspace = validateStoredWorkspace(JSON.parse(raw));
        cache = { raw, workspace: cloneData(workspace) };
        return remember(workspace, raw);
      } catch (error) {
        if (isDomainError(error) && error.code === "STORAGE_CORRUPT") throw error;
        throw createDomainError({
          code: "STORAGE_CORRUPT",
          message: "Saved workspace is unreadable",
          status: 500,
        });
      }
    },
    saveWorkspace(workspace) {
      const current = readRaw();
      if (stamps.has(workspace) && stamps.get(workspace) !== current) {
        throw createDomainError({
          code: "CONFLICT",
          message: "Workspace changed in another tab. Reload and try again.",
          status: 409,
        });
      }
      const value = validateStoredWorkspace(workspace);
      const text = JSON.stringify(value);
      try {
        storage.setItem(key, text);
      } catch {
        throw createDomainError({
          code: "STORAGE_WRITE_FAILED",
          message: "Workspace could not be saved",
          status: 500,
        });
      }
      cache = { raw: text, workspace: cloneData(value) };
      return cloneData(value);
    },
    clearWorkspace() {
      cache = null;
      try {
        storage.removeItem(key);
      } catch {
        throw createDomainError({
          code: "STORAGE_UNAVAILABLE",
          message: "Browser storage is unavailable",
          status: 500,
        });
      }
    },
  };
}
