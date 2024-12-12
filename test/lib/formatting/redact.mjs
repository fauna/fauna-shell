import { expect } from "chai";

import {
  redact,
  redactedStringify,
} from "../../../src/lib/formatting/redact.mjs";

describe("redact", () => {
  it("returns null/undefined values unchanged", () => {
    expect(redact(null)).to.be.null;
    expect(redact(undefined)).to.be.undefined;
  });

  it("completely redacts strings shorter than 12 characters", () => {
    expect(redact("short")).to.equal("*****");
    expect(redact("mediumtext")).to.equal("**********");
  });

  it("keeps last 4 characters for strings between 12 and 15 characters", () => {
    expect(redact("123456789012")).to.equal("********9012");
    expect(redact("1234567890123")).to.equal("*********0123");
  });

  it("keeps first and last 4 characters for strings 16 or more characters", () => {
    expect(redact("1234567890123456")).to.equal("1234********3456");
    expect(redact("12345678901234567")).to.equal("1234*********4567");
  });
});

describe("redactedStringify", () => {
  it("redacts keys containing 'secret'", () => {
    const obj = {
      normal: "visible",
      secret: "hide-me",
      mySecret: "hide-this-too",
      secret_key: "also-hidden",
      bigSecret: "this-is-a-long-secret",
    };
    const result = JSON.parse(redactedStringify(obj));

    expect(result.normal).to.equal("visible");
    expect(result.secret).to.equal("*******");
    expect(result.mySecret).to.equal("*********-too");
    expect(result.secret_key).to.equal("***********");
    expect(result.bigSecret).to.equal("this*************cret");
  });

  it("redacts keys containing 'accountkey'", () => {
    const obj = {
      accountkey: "secret",
      account_key: "1234567890123",
      myaccountkey: "1234567890123456",
      longaccountkey: "test-account-key-1",
    };
    const result = JSON.parse(redactedStringify(obj));

    expect(result.accountkey).to.equal("******");
    expect(result.account_key).to.equal("*********0123");
    expect(result.myaccountkey).to.equal("1234********3456");
    expect(result.longaccountkey).to.equal("test**********ey-1");
  });

  it("respects custom replacer function", () => {
    const obj = {
      secret: "hide-me",
      normal: "show-me",
      longSecret: "12345678901234567890123456789012",
    };
    const replacer = (key, value) =>
      key === "normal" ? value.toUpperCase() : value;

    const result = JSON.parse(redactedStringify(obj, replacer));

    expect(result.secret).to.equal("*******");
    expect(result.normal).to.equal("SHOW-ME");
    expect(result.longSecret).to.equal("1234************************9012");
  });

  it("respects space parameter for formatting", () => {
    const obj = {
      normal: "visible",
      secret: "hide-me",
      longSecret: "1234567890123456",
    };
    const formatted = redactedStringify(obj, null, 2);

    expect(formatted).to.include("\n");
    expect(formatted).to.include("  ");
    expect(JSON.parse(formatted)).to.deep.equal({
      normal: "visible",
      secret: "*******",
      longSecret: "1234********3456",
    });
  });
});
