import { HttpRequest, HttpRequestHeaders } from "@azure/functions";

import type { Response } from "./types/response";

export const defaultResponseHeaders: HttpRequestHeaders = {
  "Content-Type": "application/json",
};

export function createBadRequestResponse(
  req: HttpRequest,
  message: string
): Response {
  const { body, headers, method } = req;
  return {
    status: 400,
    headers: defaultResponseHeaders,
    body: {
      status: 400,
      message,
      request: { body, headers, method },
    },
  };
}

export function createErrorResponse(
  req: HttpRequest,
  message: string
): Response {
  const { body, headers, method } = req;
  return {
    status: 500,
    headers: defaultResponseHeaders,
    body: {
      status: 500,
      message,
      request: { body, headers, method },
    },
  };
}
