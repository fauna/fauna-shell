const SchemaCommand = require("../../lib/schema-command.js");
const fetch = require("node-fetch");
const { Flags } = require("@oclif/core");

class DiffSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    // NB: Required as a flag because it will become optional eventually,
    //     once project configuration is implemented.
    dir: Flags.string({
      required: true,
      description: "The directory of .fsl files to push",
    }),
  };

  async run() {
    const fps = this.gather(this.flags.dir);
    const files = this.read(this.flags.dir, fps);
    try {
      const { urlbase, secret } = await this.fetchsetup();
      const res = await fetch(`${urlbase}/schema/1/validate?force=true`, {
        method: "POST",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
        body: this.body(files),
      });
      const json = await res.json();
      if (json.error) {
        this.error(json.error.message);
      }
      this.log(json.diff ? json.diff : "No schema differences");
    } catch (err) {
      this.error(err);
    }
  }
}

DiffSchemaCommand.description =
  "Print the diff between local and remote schema";

DiffSchemaCommand.examples = ["$ fauna schema diff --dir schemas/myschema"];

module.exports = DiffSchemaCommand;
