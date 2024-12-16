import { expect } from "chai";

import { parseResponse } from "../../src/lib/account.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
} from "../../src/lib/errors.mjs";

describe("parseResponse", () => {
  const createMockResponse = (
    status,
    body = {},
    contentType = "application/json",
  ) => {
    return {
      status,
      headers: {
        get: () => contentType,
      },
      json: async () => body,
    };
  };

  it("should throw AuthenticationError for 401 status", async () => {
    const response = createMockResponse(401, {
      code: "unauthorized",
      reason: "Invalid credentials",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(AuthenticationError);
    }
  });

  it("should throw AuthorizationError for 403 status", async () => {
    const response = createMockResponse(403, {
      code: "permission_denied",
      reason: "Insufficient permissions",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(AuthorizationError);
    }
  });

  it("should throw CommandError for 400 status", async () => {
    const response = createMockResponse(400, {
      code: "bad_request",
      reason: "Invalid parameters",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
    }
  });

  it("should throw CommandError for 404 status", async () => {
    const response = createMockResponse(404, {
      code: "not_found",
      reason: "Resource not found",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
    }
  });

  it("should throw generic Error for other error status codes", async () => {
    const response = createMockResponse(500, {
      code: "internal_error",
      reason: "Server error",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
    }
  });

  it("should include status code in error message", async () => {
    const response = createMockResponse(500, {
      code: "internal_error",
      reason: "Server error",
    });

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error.message).to.include("[500]");
      expect(error.message).to.include("internal_error");
      expect(error.message).to.include("Server error");
    }
  });

  it("should not throw error when shouldThrow is false", async () => {
    const response = createMockResponse(400, {
      code: "bad_request",
      reason: "Invalid parameters",
    });

    const result = await parseResponse(response, false);
    expect(result).to.deep.equal({
      code: "bad_request",
      reason: "Invalid parameters",
    });
  });

  it("should handle non-JSON responses", async () => {
    const response = {
      status: 400,
      headers: {
        get: () => "text/plain",
      },
    };

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
      expect(error.message).to.include("[400]");
    }
  });

  it("should preserve error details in cause", async () => {
    const responseBody = {
      code: "bad_request",
      reason: "Invalid parameters",
    };
    const response = createMockResponse(400, responseBody);

    try {
      await parseResponse(response, true);
    } catch (error) {
      expect(error.cause).to.exist;
      expect(error.cause.status).to.equal(400);
      expect(error.cause.body).to.deep.equal(responseBody);
      expect(error.cause.code).to.equal("bad_request");
      expect(error.cause.reason).to.equal("Invalid parameters");
    }
  });

  it("should return parsed JSON for successful responses", async () => {
    const responseBody = { data: "success" };
    const response = createMockResponse(200, responseBody);

    const result = await parseResponse(response, true);
    expect(result).to.deep.equal(responseBody);
  });
});
