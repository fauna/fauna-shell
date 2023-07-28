const FaunaCommand = require("../../lib/fauna-command.js");
const fetch = require("node-fetch");

class ListSchemaCommand extends FaunaCommand {
  async run() {
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient();

    try {
      const res = await fetch(`${scheme}://${domain}:${port}/schema/1/files`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const json = await res.json();
      if (json.error) {
        this.error(json.error.message);
      } else {
        if (json.files.length > 0) {
          this.log("Schema files:\n");
          json.files.forEach((file) => {
            this.log(file.filename);
          });
        } else {
          this.log("No schema files");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}

ListSchemaCommand.description = "List database schema files";

ListSchemaCommand.examples = ["$ fauna schema ls"];

ListSchemaCommand.args = [];

ListSchemaCommand.flags = {
  ...FaunaCommand.flags,
};
module.exports = ListSchemaCommand;
