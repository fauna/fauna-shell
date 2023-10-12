import { expect } from "chai";
import { Secret } from "../../src/lib/secret";

describe("secret", () => {
  it("appends paths scoped secrets", () => {
    const secret = Secret.parse("fn1234");
    expect(secret.databaseScope).to.eql([]);

    secret.appendScope("foo");
    expect(secret.databaseScope).to.eql(["foo"]);

    secret.appendScope("bar");
    expect(secret.databaseScope).to.eql(["foo", "bar"]);
  });

  it("parses database paths from appendScope", () => {
    const secret = Secret.parse("fn1234");
    expect(secret.databaseScope).to.eql([]);

    secret.appendScope("foo/bar");
    expect(secret.databaseScope).to.eql(["foo", "bar"]);
  });

  it("disallows empty secrets", () => {
    expect(() => Secret.parse("")).to.throw("Secret cannot be empty");
  });

  it("disallows scoped secrets", () => {
    expect(() => Secret.parse("fn1234:foo")).to.throw(
      "Secret cannot be scoped"
    );
  });

  it("builds a secret with a role", () => {
    const secret = Secret.parse("fn1234");
    expect(secret.buildSecret()).to.equal("fn1234");
    expect(secret.buildSecret({ role: "admin" })).to.equal("fn1234:admin");
    expect(secret.buildSecret({ role: "server" })).to.equal("fn1234:server");
    expect(secret.buildSecret({ role: "server-readonly" })).to.equal(
      "fn1234:server-readonly"
    );
    expect(secret.buildSecret({ role: "client" })).to.equal("fn1234:client");
    expect(secret.buildSecret({ role: "foo" })).to.equal("fn1234:@role/foo");
  });

  it("builds a secret with a scope", () => {
    const secret = Secret.parse("fn1234");
    secret.appendScope("foo");
    expect(secret.buildSecret()).to.equal("fn1234:foo:admin");
    secret.appendScope("bar");
    expect(secret.buildSecret()).to.equal("fn1234:foo/bar:admin");
  });

  it("builds a secret with a scope and role", () => {
    const secret = Secret.parse("fn1234");
    secret.appendScope("foo/bar");
    expect(secret.buildSecret()).to.equal("fn1234:foo/bar:admin");
    expect(secret.buildSecret({ role: "admin" })).to.equal(
      "fn1234:foo/bar:admin"
    );
    expect(secret.buildSecret({ role: "server" })).to.equal(
      "fn1234:foo/bar:server"
    );
    expect(secret.buildSecret({ role: "foo" })).to.equal(
      "fn1234:foo/bar:@role/foo"
    );
  });
});
