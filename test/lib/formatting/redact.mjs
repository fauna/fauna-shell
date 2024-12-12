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

  it("keeps last 4 characters for strings 12 or more characters", () => {
    expect(redact("thisislongtext")).to.equal("**********text");
    expect(redact("123456789012")).to.equal("********9012");
  });
});

describe("redactedStringify", () => {
  it("redacts keys containing 'secret'", () => {
    const obj = {
      normal: "visible",
      secret: "hide-me",
      mySecret: "hide-this-too",
      secret_key: "also-hidden",
    };
    const result = JSON.parse(redactedStringify(obj));

    expect(result.normal).to.equal("visible");
    expect(result.secret).to.equal("*******");
    expect(result.mySecret).to.equal("*********-too");
    expect(result.secret_key).to.equal("***********");
  });

  it("redacts keys containing 'accountkey'", () => {
    const obj = {
      accountkey: "secret",
      account_key: "1234567901234",
      myaccountkey: "1234567901234",
    };
    const result = JSON.parse(redactedStringify(obj));

    expect(result.accountkey).to.equal("******");
    expect(result.account_key).to.equal("*********1234");
    expect(result.myaccountkey).to.equal("*********1234");
  });

  it("respects custom replacer function", () => {
    const obj = {
      secret: "hide-me",
      normal: "show-me",
    };
    const replacer = (key, value) =>
      key === "normal" ? value.toUpperCase() : value;

    const result = JSON.parse(redactedStringify(obj, replacer));

    expect(result.secret).to.equal("*******");
    expect(result.normal).to.equal("SHOW-ME");
  });

  it("respects space parameter for formatting", () => {
    const obj = { normal: "visible", secret: "hide-me" };
    const formatted = redactedStringify(obj, null, 2);

    expect(formatted).to.include("\n");
    expect(formatted).to.include("  ");
    expect(JSON.parse(formatted)).to.deep.equal({
      normal: "visible",
      secret: "*******",
    });
  });
});
