import { cloneData } from "../utils/json.js";
import { createDomainError, normalizePresetList } from "../utils/validation.js";

export function createPresetService({ storageService, idGenerator }) {
  return {
    list() {
      return cloneData(storageService.loadWorkspace().presets);
    },
    create(input) {
      const workspace = storageService.loadWorkspace();
      const preset = {
        id: idGenerator(),
        name: input.name,
        method: input.method,
        url: input.url,
        headers: input.headers,
        bodyText: input.bodyText,
      };
      normalizePresetList([...workspace.presets, preset]);
      workspace.presets.push(preset);
      storageService.saveWorkspace(workspace);
      return cloneData(storageService.loadWorkspace().presets.find((item) => item.id === preset.id));
    },
    remove(id) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.presets.findIndex((preset) => preset.id === id);
      if (index < 0) {
        throw createDomainError({ code: "NOT_FOUND", message: "Preset was not found", status: 404 });
      }
      const [removed] = workspace.presets.splice(index, 1);
      storageService.saveWorkspace(workspace);
      return cloneData(removed);
    },
  };
}
