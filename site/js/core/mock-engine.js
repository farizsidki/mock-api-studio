import { checkAuthentication, parseJsonBody, validateRequest } from "./middleware.js";
import { matchRoute } from "./route-matcher.js";
import { buildResponse } from "./response-builder.js";
import { cloneData, isPlainObject } from "../utils/json.js";
import { HTTP_METHODS, isDomainError } from "../utils/validation.js";

function responseFor({
  status,
  code,
  message,
  headers,
  body = null,
  error = null,
  endpoint = null,
  routeParams = {},
  started,
  clock,
}) {
  return buildResponse({
    status,
    headers: headers ?? { "Content-Type": "application/json" },
    body,
    error: error ?? (code ? { code, message } : null),
    metadata: {
      elapsedMs: clock() - started,
      matchedEndpointId: endpoint?.id ?? null,
      routeParams,
    },
  });
}

function invalid(message, request, started, clock) {
  return {
    response: responseFor({
      status: 400,
      code: "INVALID_REQUEST",
      message,
      started,
      clock,
    }),
    logMethod: typeof request?.method === "string" ? request.method : "",
    logPath: typeof request?.url === "string" ? request.url : "",
  };
}

function pickStaticResponse(handler, scenarioId) {
  const scenarios = handler.scenarios || [];
  if (scenarioId) {
    const found = scenarios.find((item) => item.id === scenarioId);
    if (found) return found.response;
  }
  if (handler.activeScenarioId) {
    const active = scenarios.find((item) => item.id === handler.activeScenarioId);
    if (active) return active.response;
  }
  return handler.response;
}

function staticResult(handler, scenarioId) {
  const response = pickStaticResponse(handler, scenarioId);
  return {
    status: response.status,
    headers: cloneData(response.headers),
    body: cloneData(response.body),
    error: null,
  };
}

export function createMockEngine({ endpointService, collectionService, logger, sleep, clock }) {
  async function finish(outcome, started) {
    const response = outcome.response ?? outcome;
    try {
      logger.add({
        method: outcome.logMethod,
        path: outcome.logPath,
        status: response.status,
        elapsedMs: response.elapsedMs,
        matchedEndpointId: response.matchedEndpointId,
      });
    } catch {
      // A log failure must not hide the simulated response.
    }
    return response;
  }

  async function run(request, started) {
    if (!isPlainObject(request)) return invalid("Request must be an object", request, started, clock);
    if (!HTTP_METHODS.includes(request.method)) {
      return invalid("Method is not supported", request, started, clock);
    }
    if (typeof request.url !== "string" || request.url.length === 0) {
      return invalid("URL is required", request, started, clock);
    }
    if (!isPlainObject(request.headers) || Object.values(request.headers).some((value) => typeof value !== "string")) {
      return invalid("Headers must be strings", request, started, clock);
    }
    if (request.bodyText != null && typeof request.bodyText !== "string") {
      return invalid("Request body must be a string", request, started, clock);
    }

    let url;
    try {
      url = new URL(request.url, "https://mock.local");
    } catch {
      return invalid("URL is invalid", request, started, clock);
    }
    if (url.origin !== "https://mock.local" || url.username || url.password) {
      return invalid("Only mock.local simulation URLs are allowed", request, started, clock);
    }

    const endpoints = endpointService.list();
    const matched = matchRoute({ method: request.method, pathname: url.pathname, endpoints });
    const logPath = `${url.pathname}${url.search}`;
    const baseLog = { logMethod: request.method, logPath };

    if (matched.error === "BAD_ENCODING") {
      return {
        ...baseLog,
        response: responseFor({
          status: 400,
          code: "BAD_ENCODING",
          message: "Path encoding is invalid",
          started,
          clock,
        }),
      };
    }
    if (matched.error === "AMBIGUOUS_ROUTE") {
      return {
        ...baseLog,
        response: responseFor({
          status: 500,
          code: "AMBIGUOUS_ROUTE",
          message: "Ambiguous route",
          started,
          clock,
        }),
      };
    }
    if (!matched.match && matched.pathMatched) {
      return {
        ...baseLog,
        response: responseFor({
          status: 405,
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
          headers: {
            "Content-Type": "application/json",
            Allow: matched.allowedMethods.join(", "),
          },
          started,
          clock,
        }),
      };
    }
    if (!matched.match) {
      return {
        ...baseLog,
        response: responseFor({
          status: 404,
          code: "ROUTE_NOT_FOUND",
          message: "No matching endpoint",
          started,
          clock,
        }),
      };
    }

    const endpoint = matched.match;
    const routeParams = matched.routeParams;
    const auth = checkAuthentication({ endpoint, headers: request.headers });
    if (!auth.ok) {
      await sleep(endpoint.delayMs);
      return {
        ...baseLog,
        response: responseFor({
          status: 401,
          error: auth.error,
          endpoint,
          routeParams,
          started,
          clock,
        }),
      };
    }

    const parsed = parseJsonBody(request.bodyText ?? "");
    if (!parsed.ok) {
      await sleep(endpoint.delayMs);
      return {
        ...baseLog,
        response: responseFor({
          status: 400,
          error: parsed.error,
          endpoint,
          routeParams,
          started,
          clock,
        }),
      };
    }

    const valid = validateRequest({ endpoint, body: parsed.value, query: url.searchParams });
    if (!valid.ok) {
      await sleep(endpoint.delayMs);
      return {
        ...baseLog,
        response: responseFor({
          status: 422,
          error: valid.error,
          endpoint,
          routeParams,
          started,
          clock,
        }),
      };
    }

    let handlerResult;
    try {
      handlerResult = endpoint.handler.type === "static"
        ? staticResult(endpoint.handler, request.scenarioId)
        : collectionService.execute({
          collectionId: endpoint.handler.collectionId,
          operation: endpoint.handler.operation,
          routeParams,
          body: parsed.value,
        });
    } catch (error) {
      await sleep(endpoint.delayMs);
      if (isDomainError(error)) {
        return {
          ...baseLog,
          response: responseFor({
            status: error.status || 500,
            code: error.code,
            message: error.message,
            endpoint,
            routeParams,
            started,
            clock,
          }),
        };
      }
      return {
        ...baseLog,
        response: responseFor({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Internal simulation error",
          endpoint,
          routeParams,
          started,
          clock,
        }),
      };
    }

    await sleep(endpoint.delayMs);
    return {
      ...baseLog,
      response: buildResponse({
        status: handlerResult.status,
        headers: handlerResult.headers ?? { "Content-Type": "application/json" },
        body: handlerResult.body,
        error: handlerResult.error,
        metadata: {
          elapsedMs: clock() - started,
          matchedEndpointId: endpoint.id,
          routeParams,
        },
      }),
    };
  }

  return {
    async simulateRequest(request) {
      const started = clock();
      try {
        return await finish(await run(request, started));
      } catch {
        return finish({
          logMethod: typeof request?.method === "string" ? request.method : "",
          logPath: typeof request?.url === "string" ? request.url : "",
          response: responseFor({
            status: 500,
            code: "INTERNAL_ERROR",
            message: "Internal simulation error",
            started,
            clock,
          }),
        });
      }
    },
  };
}
