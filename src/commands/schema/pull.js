const FaunaCommand = require("../../lib/fauna-command.js");
const { Args } = require("@oclif/core");
const fetch = require("node-fetch");

class PullSchemaCommand extends FaunaCommand {
  async run() {
    const filename = this.args.filename;
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient();

    try {
      const res = await fetch(`${scheme}://${domain}:${port}/schema/1/files/${filename}`, {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
      });
      const json = await res.json();
      this.log(json.content);
    } catch (err) {
      this.error(err);
    }
  }
}

PullSchemaCommand.description =
  "Pull a database schema file and display its contents";

PullSchemaCommand.examples = ["$ fauna schema:pull main.fsl"];

PullSchemaCommand.args = {
  filename: Args.string({
    required: true,
    description: "name of schema file",
  }),
};

PullSchemaCommand.flags = {
  ...FaunaCommand.flags,
};
module.exports = PullSchemaCommand;
