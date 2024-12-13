import { expect } from "chai";
import stripAnsi from "strip-ansi";

import { run } from "../../../src/cli.mjs";
import { setupRealContainer } from "../../../src/config/setup-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";

describe("colorize", () => {
  beforeEach(async () => {
    // hack to get the codeToAnsi hooked up.
    const container = await setupRealContainer();
    await run("--version", container);
  });

  [
    { format: Format.LOG, input: "Taco 8443 'Bell'", expected: "succeed" },
    { format: Format.LOG, input: { hi: "Taco 8443 'Bell'" }, expected: "fail" },
    { format: Format.FQL, input: "Collection.all()", expected: "succeed" },
    { format: Format.FQL, input: { hi: "Collection.all()" }, expected: "fail" },
    { format: Format.TEXT, input: "Hi 'Mom' how are 23", expected: "succeed" },
    {
      format: Format.TEXT,
      input: { hi: "Hi 'Mom' how are 23" },
      expected: "fail",
    },
    { format: Format.JSON, input: { string: "23" }, expected: "succeed" },
  ].forEach(({ format, input, expected }) => {
    it(`should ${expected} for ${JSON.stringify(input)} in format ${format}`, () => {
      let fail = false;
      try {
        const result = colorize(input, { format });
        if (format !== Format.TEXT) {
          expect(result).to.not.equal(input);
        } else {
          expect(result).to.equal(input);
        }
        if (format !== Format.JSON) {
          expect(stripAnsi(result)).to.equal(input);
        } else {
          expect(stripAnsi(result)).to.not.equal(result);
        }
      } catch (e) {
        fail = true;
      }
      expect(fail).to.equal(expected === "fail");
    });
  });

  it("Fails for ciruclar JSON", () => {
    const input = { hi: "Collection.all()" };
    input.input = input;
    let fail = false;
    try {
      colorize(input, { format: Format.JSON });
    } catch (e) {
      fail = true;
    }
    expect(fail).to.equal(true);
  });
});
