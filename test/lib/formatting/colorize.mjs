import { expect } from "chai";

import { run } from "../../../src/cli.mjs";
import { setupRealContainer } from "../../../src/config/setup-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";

/* eslint-disable-next-line no-control-regex */
const ansiRegex = /\u001b\[\d{1,2}(;\d{1,2})*m/g;

describe("colorize", () => {
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
    it(`should ${expected} for ${JSON.stringify(input)} in format ${format}`, async () => {
      const container = await setupRealContainer();
      await run("--version", container);
      let fail = false;
      let result;
      try {
        result = colorize(input, { format });
      } catch (e) {
        fail = true;
      }
      expect(fail).to.equal(expected === "fail");
      if (!fail) {
        if (format !== Format.TEXT) {
          expect(ansiRegex.test(result)).to.be.true;
        } else {
          expect(ansiRegex.test(result)).to.be.false;
        }
      }
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
