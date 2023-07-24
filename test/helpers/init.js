// require("dotenv").config();
// const path = require("path");
// require("dotenv").config();
//
// process.env.TS_NODE_PROJECT = path.resolve("test/tsconfig.json");

const path = require("path");
process.env.TS_NODE_PROJECT = path.resolve("test/tsconfig.json");
process.env.NODE_ENV = "development";

global.oclif = global.oclif || {};
global.oclif.columns = 80;
