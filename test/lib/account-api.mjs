import * as awilix from "awilix";
import { expect } from "chai";
import sinon from "sinon";

import { setContainer } from "../../src/config/container.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import accountAPI, {
  fetchWithAccountKey,
  responseHandler,
  toResource,
} from "../../src/lib/account-api.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
} from "../../src/lib/errors.mjs";
import { f } from "../helpers.mjs";

describe("toResource", () => {
  it("should build a URL with the correct endpoint and parameters", () => {
    const url = toResource({ endpoint: "/users", params: { limit: 10 } });
    expect(url.toString()).to.equal(
      "https://account.fauna.com/api/v1/users?limit=10",
    );
  });

  it("should respect v2 endpoints when specified", () => {
    const url = toResource({
      endpoint: "/users",
      params: { limit: 10 },
      version: "/v2",
    });
    expect(url.toString()).to.equal(
      "https://account.fauna.com/v2/users?limit=10",
    );
  });
});

describe("responseHandler", () => {
  const createMockResponse = (
    status,
    body = {},
    contentType = "application/json",
  ) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: () => contentType,
      },
      json: async () => body,
    };
  };

  it("should standardize v1 and v2 endpoint errors to the same CommandError", async () => {
    const v1Response = createMockResponse(400, {
      code: "bad_request",
      reason: "Database is not specified",
    });
    const v2Response = createMockResponse(400, {
      error: {
        code: "bad_request",
        message: "Database is not specified",
      },
    });

    let v1Error, v2Error;
    try {
      await responseHandler(v1Response);
    } catch (error) {
      v1Error = error;
    }

    try {
      await responseHandler(v2Response);
    } catch (error) {
      v2Error = error;
    }

    // Check that the errors are equal instances of a CommandError
    expect(v1Error).to.be.instanceOf(CommandError);
    expect(v2Error).to.be.instanceOf(CommandError);
    expect(v1Error.message).to.equal(v2Error.message);
    expect(v1Error.cause).to.deep.equal(v2Error.cause);

    // Check that the errors have the correct code and message
    expect(v1Error.message).to.equal("Database is not specified");
  });

  it("should throw AuthenticationError for 401 status", async () => {
    const response = createMockResponse(401, {
      code: "unauthorized",
      reason: "Invalid credentials",
    });

    try {
      await responseHandler(response);
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
      await responseHandler(response);
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
      await responseHandler(response);
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
      await responseHandler(response);
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
    }
  });

  it("should throw generic Error for other error status codes", async () => {
    const response = createMockResponse(500, {
      code: "internal_error",
      reason: "This is a server error",
    });

    try {
      await responseHandler(response);
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
    }
  });

  it("should handle non-JSON responses", async () => {
    const response = {
      status: 400,
      headers: {
        get: () => "text/plain",
      },
    };

    try {
      await responseHandler(response);
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
      expect(error.message).to.equal(
        "An unknown error occurred while making a request to the Account API.",
      );
    }
  });

  it("should preserve error details in cause", async () => {
    const responseBody = {
      code: "bad_request",
      reason: "Invalid parameters",
    };
    const response = createMockResponse(400, responseBody);

    try {
      await responseHandler(response);
    } catch (error) {
      expect(error.cause).to.exist;
      expect(error.cause.status).to.equal(400);
      expect(error.cause.body).to.deep.equal(responseBody);
      expect(error.cause.code).to.equal("bad_request");
      expect(error.cause.message).to.equal("Invalid parameters");
    }
  });

  it("should return parsed JSON for successful responses", async () => {
    const responseBody = { data: "success" };
    const response = createMockResponse(200, responseBody);

    const result = await responseHandler(response);
    expect(result).to.deep.equal(responseBody);
  });
});

describe("accountAPI", () => {
  let container, fetch;

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");

    container.register({
      credentials: awilix.asValue({
        accountKeys: {
          key: "some-account-key",
          onInvalidCreds: async () => {
            container.resolve("credentials").accountKeys.key =
              "new-account-key";
            return Promise.resolve();
          },
          promptLogin: sinon.stub(),
        },
      }),
    });

    setContainer(container);
  });

  describe("fetchWithAccountKey", () => {
    it("should call the endpoint with the correct headers", async () => {
      await fetchWithAccountKey("https://account.fauna.com/api/v1/databases", {
        method: "GET",
      });

      expect(fetch).to.have.been.calledWith(
        "https://account.fauna.com/api/v1/databases",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        },
      );
    });

    it("should retry once when the response is a 401", async () => {
      fetch
        .withArgs("https://account.fauna.com/api/v1/databases")
        .onCall(0)
        .resolves(f(null, 401));

      fetch
        .withArgs("https://account.fauna.com/api/v1/databases")
        .onCall(1)
        .resolves(f({ results: [] }, 200));

      const response = await fetchWithAccountKey(
        "https://account.fauna.com/api/v1/databases",
        {
          method: "GET",
        },
      );

      expect(fetch).to.have.been.calledWith(
        "https://account.fauna.com/api/v1/databases",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        },
      );
      expect(fetch).to.have.been.calledWith(
        "https://account.fauna.com/api/v1/databases",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer new-account-key",
          },
        },
      );
      expect(await response.json()).to.deep.equal({ results: [] });
    });

    it("should only retry authorization errors once", async () => {
      fetch
        .withArgs("https://account.fauna.com/api/v1/databases")
        .resolves(f(null, 401));

      const response = await fetchWithAccountKey(
        "https://account.fauna.com/api/v1/databases",
        {
          method: "GET",
        },
      );

      expect(response.status).to.equal(401);
      expect(await response.json()).to.deep.equal(null);
    });
  });

  describe("listDatabases", () => {
    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases?max_results=1000",
          }),
          sinon.match.any,
        )
        .resolves(
          f({
            results: [{ name: "test-db", path: "us-std/test-db" }],
          }),
        );

      const data = await accountAPI.listDatabases({});

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/api/v1/databases?max_results=1000",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );

      expect(data).to.deep.equal({
        results: [{ name: "test-db", path: "us-std/test-db" }],
      });
    });

    it("should call the endpoint with a path", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases?max_results=1000&path=us-std%2Ftest-db",
          }),
        )
        .resolves(
          f({
            results: [{ name: "test-db", path: "us-std/test-db" }],
          }),
        );

      const data = await accountAPI.listDatabases({ path: "us-std/test-db" });

      expect(data).to.deep.equal({
        results: [{ name: "test-db", path: "us-std/test-db" }],
      });
    });
  });

  describe("createKey", () => {
    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases/keys",
          }),
          sinon.match.any,
        )
        .resolves(
          f(
            {
              id: "key-id",
              role: "admin",
              path: "us-std/test-db",
              ttl: "2025-01-01T00:00:00.000Z",
              name: "test-key",
            },
            201,
          ),
        );

      const data = await accountAPI.createKey({
        path: "us/test-db",
        role: "admin",
        ttl: "2025-01-01T00:00:00.000Z",
        name: "test-key",
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/api/v1/databases/keys",
        }),
        sinon.match({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer some-account-key",
          },
          body: JSON.stringify({
            role: "admin",
            path: "us-std/test-db",
            ttl: "2025-01-01T00:00:00.000Z",
            name: "test-key",
          }),
        }),
      );

      expect(data).to.deep.equal({
        id: "key-id",
        role: "admin",
        path: "us-std/test-db",
        ttl: "2025-01-01T00:00:00.000Z",
        name: "test-key",
      });
    });
  });
});
