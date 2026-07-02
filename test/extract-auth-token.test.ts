import assert from "node:assert/strict";
import type { Request } from "express";
import { extractAuthToken } from "../src/lib/extract-auth-token.js";

function mockRequest(
  partial: Partial<Request> & { cookies?: Record<string, string> },
): Request {
  return partial as Request;
}

assert.equal(
  extractAuthToken(
    mockRequest({
      cookies: { auth_token: "cookie-jwt" },
    }),
  ),
  "cookie-jwt",
);

assert.equal(
  extractAuthToken(
    mockRequest({
      headers: { authorization: "Bearer header-jwt" },
    }),
  ),
  "header-jwt",
);

assert.equal(
  extractAuthToken(
    mockRequest({
      cookies: { auth_token: "cookie-jwt" },
      headers: { authorization: "Bearer header-jwt" },
    }),
  ),
  "cookie-jwt",
);

assert.equal(extractAuthToken(mockRequest({})), "");

console.log("extract-auth-token.test.ts: ok");
