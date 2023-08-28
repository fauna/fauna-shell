const SchemaCommand = require("./schema-command.js");
const { Args } = require("@oclif/core");
const fetch = require("node-fetch");

class CatSchemaCommand extends SchemaCommand {
  async run() {
    const filename = this.args.filename;
    const { urlbase, secret } = await this.fetchsetup();

    try {
      const res = await fetch(`${urlbase}/schema/1/files/${filename}`, {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
      });
      const json = await res.json();
      if (json.error) {
        this.error(json.error.message);
      } else {
        this.log(json.content);
      }
    } catch (err) {
      this.error(err);
    }
  }
}

CatSchemaCommand.description = "Display the contents of a schema file";

CatSchemaCommand.examples = ["$ fauna schema cat main.fsl"];

CatSchemaCommand.args = {
  filename: Args.string({
    required: true,
    description: "name of schema file",
  }),
};

CatSchemaCommand.flags = {
  ...SchemaCommand.flags,
};
module.exports = CatSchemaCommand;
