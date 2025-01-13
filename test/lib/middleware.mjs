//@ts-check

import { expect } from "chai";

import { setupTestContainer } from "../../src/config/setup-test-container.mjs";
import { applyLocalArg, scopeSecret } from "../../src/lib/middleware.mjs";

describe("middlewares", function () {
  describe("applyLocalArg", function () {
    /** @type {import('yargs').Arguments & { url?: string, secret?: string }} */
    const baseArgv = { _: [], $0: "", verboseComponent: [] };

    it("should set url to 0.0.0.0:8443 when --local is true and no url provided", function () {
      const argv = { ...baseArgv, local: true };
      applyLocalArg(argv);
      expect(argv.url).to.equal("http://0.0.0.0:8443");
      expect(argv.secret).to.equal("secret");
    });

    it("should respect provided url even when --local is true", function () {
      const argv = { ...baseArgv, local: true, url: "http://custom-url:8443" };
      applyLocalArg(argv);
      expect(argv.url).to.equal("http://custom-url:8443");
      expect(argv.secret).to.equal("secret");
    });

    it("should default to fauna cloud url when --local is false", function () {
      const argv = { ...baseArgv };
      applyLocalArg(argv);
      expect(argv.url).to.equal("https://db.fauna.com");
      expect(argv.secret).to.be.undefined;
    });

    it("should not modify secret if already provided", function () {
      const argv = { ...baseArgv, local: true, secret: "custom-secret" };
      applyLocalArg(argv);
      expect(argv.url).to.equal("http://0.0.0.0:8443");
      expect(argv.secret).to.equal("custom-secret");
    });
  });

  describe("scopeSecret", function () {
    /** @type {import('yargs').Arguments & { secret?: string, database?: string, role?: string }} */
    const baseArgv = { _: [], $0: "", verboseComponent: [] };

    it("should set secret with database and role when both provided", function () {
      const argv = {
        ...baseArgv,
        secret: "secret",
        database: "mydb",
        role: "myrole",
      };
      scopeSecret(argv);
      expect(argv.secret).to.equal("secret:mydb:myrole");
    });

    it("should set secret with role only when only role provided", function () {
      const argv = { ...baseArgv, secret: "secret", role: "myrole" };
      scopeSecret(argv);
      expect(argv.secret).to.equal("secret:myrole");
    });

    it("should set secret with database and admin when only database provided", function () {
      const argv = { ...baseArgv, secret: "secret", database: "mydb" };
      scopeSecret(argv);
      expect(argv.secret).to.equal("secret:mydb:admin");
    });
  });
});
