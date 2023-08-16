const { loadEndpoints } = require("../lib/misc.js");
const FaunaCommand = require("../lib/fauna-command.js");

class ListEndpointsCommand extends FaunaCommand {
  async run() {
    return loadEndpoints()
      .then((endpoints) => {
        var keys = Object.keys(endpoints);
        if (keys.length === 0) {
          throw new Error(
            "No endpoints defined.\nSee fauna add-endpoint --help for more details."
          );
        } else {
          keys.forEach((endpoint) => {
            // skip the key that stores the default endpoint
            if (endpoint === "default") {
              // in JS return skips this iteration.
              return;
            }
            var enabled = "";
            if (endpoint === endpoints.default) {
              enabled = " *";
            }
            this.log(`${endpoint}${enabled}`);
          });
        }
      })
      .catch((err) => {
        this.error(err.message);
      });
  }
}

ListEndpointsCommand.description = `
Lists connection endpoints.
`;

ListEndpointsCommand.examples = ["$ fauna list-endpoints"];

// clear the default FaunaCommand flags that accept --host, --port, etc.
ListEndpointsCommand.flags = {};

module.exports = ListEndpointsCommand;
