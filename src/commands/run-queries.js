const { Flags } = require("@oclif/core");
const FaunaCommand = require("../lib/fauna-command.js");
const EvalCommand = require("./eval");

const DEPRECATED_MSG =
  "Deprecated: fauna run-queries is deprecated. Use eval instead";

class RunQueriesCommand extends EvalCommand {
  async run() {
    this.warn(DEPRECATED_MSG);
    this.warn("Run `fauna eval --help`");
    await super.run();
  }
}

EvalCommand.description = `
${DEPRECATED_MSG}
Runs the queries found on the file passed to the command.
`;

RunQueriesCommand.examples = [
  "$ fauna run-queries dbname --file=/path/to/queries.fql",
];

RunQueriesCommand.flags = {
  ...FaunaCommand.flags,
  file: Flags.string({
    description: "File where to read queries from",
    required: true,
  }),
};

RunQueriesCommand.args = EvalCommand.args;

module.exports = RunQueriesCommand;
