import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
chai.use(sinonChai);

// these are mocha root hooks, they're registered for _all_ files in the test run
// https://mochajs.org/#root-hook-plugins
// use them by passing the --require flag to the mocha CLI
// (this is done for you in the package.json scripts)
// https://mochajs.org/#-require-module-r-module
export const mochaHooks = {
  beforeAll() {},
  beforeEach() {},
  afterAll() {},
  afterEach() {
    // https://sinonjs.org/releases/v19/general-setup/
    sinon.restore();
  },
};
