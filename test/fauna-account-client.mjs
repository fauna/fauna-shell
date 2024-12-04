//@ts-check

import { expect } from "chai";

import { FaunaAccountClient } from "../src/lib/fauna-account-client.mjs";

describe("FaunaAccountClient", () => {
  let client;

  beforeEach(() => {
    client = new FaunaAccountClient();
  });

  [
    // Edge cases
    { original: undefined, expected: undefined },
    { original: null, expected: null },
    { original: "", expected: "" },
    { original: "/", expected: "" },
    { original: "us/", expected: "us-std" },
    { original: "/us", expected: "us-std" },
    // Standardizes shorthand to full region group
    { original: "us", expected: "us-std" },
    { original: "us/example", expected: "us-std/example" },
    { original: "eu", expected: "eu-std" },
    { original: "eu/example", expected: "eu-std/example" },
    { original: "classic", expected: "global" },
    { original: "classic/example", expected: "global/example" },
    // Leaves full region group unchanged
    { original: "us-std", expected: "us-std" },
    { original: "us-std/example", expected: "us-std/example" },
    { original: "eu-std", expected: "eu-std" },
    { original: "eu-std/example", expected: "eu-std/example" },
    { original: "global", expected: "global" },
    { original: "global/example", expected: "global/example" },
  ].forEach(({ original, expected }) => {
    it(`standardizes ${original} to ${expected}`, () => {
      expect(client.standardizeRegion(original)).to.equal(expected);
    });
  });
});
