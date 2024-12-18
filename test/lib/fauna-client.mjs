import { expect } from "chai";

import { FQL_DIAGNOSTIC_REGEX } from "../../src/lib/fauna-client.mjs";

describe("FQL_DIAGNOSTIC_REGEX", () => {
  const validLines = ["1 |", "12 |", "123 |", "  |", "   |", "    |", " 1 |"];

  const invalidLines = [
    "normal text",
    "1  |",
    "| invalid",
    "abc |",
    "|",
    "1|",
    " | ",
    "text | more",
  ];

  validLines.forEach((line) => {
    it(`should match diagnostic line: "${line}"`, () => {
      expect(line).to.match(FQL_DIAGNOSTIC_REGEX);
    });
  });

  invalidLines.forEach((line) => {
    it(`should not match non-diagnostic line: "${line}"`, () => {
      expect(line).to.not.match(FQL_DIAGNOSTIC_REGEX);
    });
  });
});
