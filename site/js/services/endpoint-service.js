import { routesConflict } from "../core/route-matcher.js";
import { cloneData } from "../utils/json.js";
import { createDomainError, validateEndpointInput } from "../utils/validation.js";

function notFound() {
  return createDomainError({ code: "NOT_FOUND", message: "Endpoint was not found", status: 404 });
}

function copyPath(path, attempt) {
  const suffix = attempt === 1 ? "-copy" : `-copy-${attempt}`;
  const segments = path.split("/").slice(1);
  const paramAt = segments.findIndex((segment) => segment.startsWith(":"));
  if (paramAt === -1) return `${path}${suffix}`;
  if (paramAt === 0) return `/${suffix.slice(1)}/${segments.join("/")}`;
  const next = segments.slice();
  next[paramAt - 1] = `${segments[paramAt - 1]}${suffix}`;
  return `/${next.join("/")}`;
}

function nextCopyPath(path, method, endpoints) {
  for (let attempt = 1; attempt < 100; attempt += 1) {
    const candidate = copyPath(path, attempt);
    const taken = endpoints.some((endpoint) => endpoint.method === method && routesConflict(endpoint.path, candidate));
    if (!taken) return candidate;
  }
  throw createDomainError({ code: "CONFLICT", message: "No available duplicate path", status: 409 });
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
    duplicate(id) {
      const workspace = storageService.loadWorkspace();
      const source = workspace.endpoints.find((endpoint) => endpoint.id === id);
      if (!source) throw notFound();
      const path = nextCopyPath(source.path, source.method, workspace.endpoints);
      const copy = cloneData(source);
      copy.id = idGenerator();
      copy.name = `${source.name} copy`;
      copy.path = path;
      workspace.endpoints.push(copy);
      storageService.saveWorkspace(workspace);
      return cloneData(copy);
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
