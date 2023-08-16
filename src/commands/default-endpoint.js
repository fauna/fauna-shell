const { setDefaultEndpoint } = require("../lib/misc.js");
const { Args } = require("@oclif/core");
const FaunaCommand = require("../lib/fauna-command.js");

class DefaultEndpointCommand extends FaunaCommand {
  async run() {
    return setDefaultEndpoint(this.args.endpoint_alias)
      .then(this.log)
      .catch((err) => {
        this.error(err.message, 1);
      });
  }
}

DefaultEndpointCommand.description = `
Sets an endpoint as the default one
`;

DefaultEndpointCommand.examples = ["$ fauna default-endpoint endpoint"];

// clear the default FaunaCommand flags that accept --host, --port, etc.
DefaultEndpointCommand.flags = {};

DefaultEndpointCommand.args = {
  // eslint-disable-next-line camelcase
  endpoint_alias: Args.string({
    required: true,
    description: "Fauna server endpoint alias",
  }),
};

module.exports = DefaultEndpointCommand;
