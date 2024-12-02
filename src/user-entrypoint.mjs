#!/usr/bin/env node

//@ts-check

import { hideBin } from "yargs/helpers";

import { run } from "./cli.mjs";
import { setupRealContainer as setupContainer } from "./config/setup-container.mjs";

(async () => {
  run(hideBin(process.argv), setupContainer());
})();
