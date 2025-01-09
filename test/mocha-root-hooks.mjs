//@ts-check

import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { setContainer } from "../src/config/container.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";

chai.use(sinonChai);

// these are mocha root hooks, they're registered for _all_ files in the test run
// https://mochajs.org/#root-hook-plugins
// use them by passing the --require flag to the mocha CLI
// (this is done for you in the package.json scripts)
// https://mochajs.org/#-require-module-r-module
export const mochaHooks = {
  beforeAll() {
    setContainer(setupContainer());
  },
  // NOTE: We _could_ use setContainer here, but it slows down the tests. Given the amount of tests that require
  // access to the container outside of run is low, we are not going to reset the container for each test here.
  beforeEach() {},
  afterAll() {},
  afterEach() {
    // https://sinonjs.org/releases/v19/general-setup/
    sinon.restore();
  },
};
