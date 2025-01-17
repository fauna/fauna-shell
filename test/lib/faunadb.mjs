import { expect } from "chai";
import faunadb from "faunadb";

import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
} from "../../src/lib/errors.mjs";
import { faunadbToCommandError } from "../../src/lib/faunadb.mjs";

describe("faunadbToCommandError", () => {
  it("should convert Unauthorized error to AuthenticationError", () => {
    const faunaError = new faunadb.errors.FaunaHTTPError("Unauthorized", {
      responseContent: {
        errors: [],
      },
    });

    expect(() => faunadbToCommandError({ err: faunaError })).to.throw(
      AuthenticationError,
    );
  });

  it("should convert PermissionDenied error to AuthorizationError", () => {
    const faunaError = new faunadb.errors.FaunaHTTPError("PermissionDenied", {
      responseContent: {
        errors: [],
      },
    });

    expect(() => faunadbToCommandError({ err: faunaError })).to.throw(
      AuthorizationError,
    );
  });

  it("should convert BadRequest error to CommandError", () => {
    const faunaError = new faunadb.errors.FaunaHTTPError("BadRequest", {
      responseContent: {
        errors: [],
      },
      responseHeaders: {},
    });

    expect(() => faunadbToCommandError({ err: faunaError })).to.throw(
      CommandError,
    );
  });

  it("should convert NotFound error to CommandError", () => {
    const faunaError = new faunadb.errors.FaunaHTTPError("NotFound", {
      responseContent: {
        errors: [],
      },
      responseHeaders: {},
    });

    expect(() => faunadbToCommandError({ err: faunaError })).to.throw(
      CommandError,
    );
  });

  it("should convert network error to CommandError with network message", () => {
    const networkError = new TypeError("fetch failed");

    expect(() => faunadbToCommandError({ err: networkError })).to.throw(
      CommandError,
      NETWORK_ERROR_MESSAGE,
    );
  });

  it("should pass through other FaunaHTTPErrors unchanged", () => {
    const faunaError = new faunadb.errors.FaunaHTTPError("Internal error", {
      responseContent: {
        errors: [],
      },
    });

    expect(() => faunadbToCommandError({ err: faunaError })).to.throw(
      faunadb.errors.FaunaHTTPError,
    );
  });

  it("should pass through other errors unchanged", () => {
    const genericError = new Error("Generic error");

    expect(() => faunadbToCommandError({ err: genericError })).to.throw(Error);
  });

  it("should call optional error handler if provided", () => {
    let handlerCalled = false;
    const handler = () => {
      handlerCalled = true;
    };
    const error = new Error("Test error");

    try {
      faunadbToCommandError({ err: error, handler });
    } catch (e) {
      // Expected to throw
    }

    expect(handlerCalled).to.be.true;
  });
});
