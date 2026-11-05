const auth = {
  enabled: false,
  type: "bearer",
  headerName: "Authorization",
  expectedValue: "",
};

function collectionEndpoint({ id, name, method, path, operation, delayMs = 0 }) {
  return {
    id,
    name,
    method,
    path,
    enabled: true,
    delayMs,
    auth,
    handler: {
      type: "collection",
      collectionId: "col_users",
      operation,
    },
  };
}

export const sampleWorkspace = {
  schemaVersion: 1,
  endpoints: [
    collectionEndpoint({
      id: "ep_users_list",
      name: "List Users",
      method: "GET",
      path: "/api/v1/users",
      operation: "list",
      delayMs: 250,
    }),
    collectionEndpoint({
      id: "ep_users_get",
      name: "Get User",
      method: "GET",
      path: "/api/v1/users/:id",
      operation: "getById",
    }),
    collectionEndpoint({
      id: "ep_users_create",
      name: "Create User",
      method: "POST",
      path: "/api/v1/users",
      operation: "create",
    }),
    collectionEndpoint({
      id: "ep_users_replace",
      name: "Replace User",
      method: "PUT",
      path: "/api/v1/users/:id",
      operation: "replace",
    }),
    collectionEndpoint({
      id: "ep_users_update",
      name: "Update User",
      method: "PATCH",
      path: "/api/v1/users/:id",
      operation: "update",
    }),
    collectionEndpoint({
      id: "ep_users_delete",
      name: "Delete User",
      method: "DELETE",
      path: "/api/v1/users/:id",
      operation: "delete",
    }),
  ],
  collections: [
    {
      id: "col_users",
      name: "Users",
      idField: "id",
      idStrategy: "autoIncrement",
      initialItems: [{ id: 1, name: "Alex", email: "alex@example.com" }],
      items: [{ id: 1, name: "Alex", email: "alex@example.com" }],
    },
  ],
};
