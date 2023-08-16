const { deleteEndpointOrError } = require("../lib/misc.js");
const { Args } = require("@oclif/core");
const FaunaCommand = require("../lib/fauna-command.js");

class DeleteEndpoint extends FaunaCommand {
  async run() {
    const alias = this.args.endpoint_alias;
    return deleteEndpointOrError(alias).catch((err) => {
      this.error(err.message, 1);
    });
  }
}

DeleteEndpoint.description = `
Deletes a connection endpoint.
`;

DeleteEndpoint.examples = ["$ fauna delete-endpoint endpoint_alias"];

// clear the default FaunaCommand flags that accept --host, --port, etc.
DeleteEndpoint.flags = {};

DeleteEndpoint.args = {
  // eslint-disable-next-line camelcase
  endpoint_alias: Args.string({
    required: true,
    description: "Fauna server endpoint alias",
  }),
};

module.exports = DeleteEndpoint;
