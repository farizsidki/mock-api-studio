import { cloneData } from "../utils/json.js";
import { createDomainError, validateEndpointInput } from "../utils/validation.js";

function notFound() {
  return createDomainError({ code: "NOT_FOUND", message: "Endpoint was not found", status: 404 });
}

export function createEndpointService({ storageService, idGenerator }) {
  return {
    list() {
      return cloneData(storageService.loadWorkspace().endpoints);
    },
    getById(id) {
      const found = storageService.loadWorkspace().endpoints.find((endpoint) => endpoint.id === id);
      if (!found) throw notFound();
      return cloneData(found);
    },
    create(input) {
      const workspace = storageService.loadWorkspace();
      const value = validateEndpointInput(input, {
        endpoints: workspace.endpoints,
        collections: workspace.collections,
      });
      const id = idGenerator();
      if (workspace.endpoints.some((endpoint) => endpoint.id === id)) {
        throw createDomainError({ code: "CONFLICT", message: "Endpoint id already exists", status: 409 });
      }
      const endpoint = { id, ...value };
      workspace.endpoints.push(endpoint);
      storageService.saveWorkspace(workspace);
      return cloneData(endpoint);
    },
    update(id, input) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.endpoints.findIndex((endpoint) => endpoint.id === id);
      if (index < 0) throw notFound();
      const value = validateEndpointInput(input, {
        endpoints: workspace.endpoints,
        collections: workspace.collections,
        ignoreId: id,
      });
      const endpoint = { id, ...value };
      workspace.endpoints[index] = endpoint;
      storageService.saveWorkspace(workspace);
      return cloneData(endpoint);
    },
    remove(id) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.endpoints.findIndex((endpoint) => endpoint.id === id);
      if (index < 0) throw notFound();
      const [removed] = workspace.endpoints.splice(index, 1);
      storageService.saveWorkspace(workspace);
      return cloneData(removed);
    },
    setEnabled(id, enabled) {
      if (typeof enabled !== "boolean") {
        throw createDomainError({ code: "VALIDATION_ERROR", message: "Enabled must be boolean" });
      }
      const workspace = storageService.loadWorkspace();
      const index = workspace.endpoints.findIndex((endpoint) => endpoint.id === id);
      if (index < 0) throw notFound();
      workspace.endpoints[index] = { ...workspace.endpoints[index], enabled };
      storageService.saveWorkspace(workspace);
      return cloneData(workspace.endpoints[index]);
    },
  };
}
