import { expect } from "chai";
import { NetworkError, ServiceError } from "fauna";

import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
} from "../../src/lib/errors.mjs";
import { faunaToCommandError } from "../../src/lib/fauna.mjs";

describe("faunaToCommandError", () => {
  it("should convert unauthorized ServiceError to AuthenticationError", () => {
    const serviceError = new ServiceError({
      error: {
        code: "unauthorized",
        message: "Invalid token",
      },
    });

    try {
      faunaToCommandError({ err: serviceError });
    } catch (error) {
      expect(error).to.be.instanceOf(AuthenticationError);
      expect(error.cause).to.equal(serviceError);
    }
  });

  it("should convert forbidden ServiceError to AuthorizationError", () => {
    const serviceError = new ServiceError({
      error: {
        code: "forbidden",
        message: "Permission denied",
      },
    });

    try {
      faunaToCommandError({ err: serviceError });
    } catch (error) {
      expect(error).to.be.instanceOf(AuthorizationError);
      expect(error.cause).to.equal(serviceError);
    }
  });

  it("should convert permission_denied ServiceError to AuthorizationError", () => {
    const serviceError = new ServiceError({
      error: {
        code: "permission_denied",
        message: "No permission",
      },
    });

    try {
      faunaToCommandError({ err: serviceError });
    } catch (error) {
      expect(error).to.be.instanceOf(AuthorizationError);
      expect(error.cause).to.equal(serviceError);
    }
  });

  it("should convert other ServiceErrors to CommandError", () => {
    const serviceError = new ServiceError({
      error: {
        code: "internal_error",
        message: "Unknown error",
      },
    });

    try {
      faunaToCommandError({ err: serviceError });
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
      expect(error.cause).to.equal(serviceError);
    }
  });

  it("should convert NetworkError to CommandError with network error message", () => {
    const networkError = new NetworkError("Network failure");

    try {
      faunaToCommandError({ err: networkError });
    } catch (error) {
      expect(error).to.be.instanceOf(CommandError);
      expect(error.message).to.equal(NETWORK_ERROR_MESSAGE);
      expect(error.cause).to.equal(networkError);
    }
  });

  it("should pass through other errors unchanged", () => {
    const genericError = new Error("Generic error");

    try {
      faunaToCommandError({ err: genericError });
    } catch (error) {
      expect(error).to.equal(genericError);
    }
  });

  it("should call custom handler if provided", () => {
    let handlerCalled = false;
    const serviceError = new ServiceError({
      error: {
        code: "unauthorized",
        message: "Invalid token",
      },
    });

    const handler = (e) => {
      handlerCalled = true;
      expect(e).to.equal(serviceError);
    };

    try {
      faunaToCommandError({ err: serviceError, handler });
    } catch (error) {
      expect(handlerCalled).to.be.true;
      expect(error).to.be.instanceOf(AuthenticationError);
    }
  });
});
