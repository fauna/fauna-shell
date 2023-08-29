const SchemaCommand = require("./schema-command.js");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Flags } = require("@oclif/core");

class PullSchemaCommand extends SchemaCommand {
  async run() {
    const { urlbase, secret } = await this.fetchsetup();

    const dir = this.flags.dir;

    try {
      const filesres = await fetch(`${urlbase}/schema/1/files`, {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
      });
      const filesjson = await filesres.json();
      if (filesjson.error) {
        this.error(filesjson.error.message);
      }
      // Sort for consistent order. It's nice for tests.
      const filenames = filesjson.files
        .map((file) => file.filename)
        .filter((name) => name.endsWith(".fsl"))
        .sort();

      // All of the below could be parallelized if necessary.
      if (!this.flags.retain) {
        // Delete all .fsl files (not directories).
        for (const deleteme of fs.readdirSync(dir)) {
          const fp = path.join(dir, deleteme);
          if (deleteme.endsWith(".fsl") && !fs.statSync(fp).isDirectory()) {
            fs.unlinkSync(fp);
          }
        }
      }

      for (const filename of filenames) {
        const fileres = await fetch(`${urlbase}/schema/1/files/${filename}`, {
          method: "GET",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
        });
        const filejson = await fileres.json();
        if (filejson.error) {
          this.error(filejson.error.message);
        }
        const fp = path.join(dir, filename);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, filejson.content);
      }
    } catch (err) {
      this.error(err);
    }
  }
}

PullSchemaCommand.description =
  "Pull a database schema's .fsl files into a directory";

PullSchemaCommand.examples = [
  "$ fauna schema pull --dir schemas/myschema --retain",
];

PullSchemaCommand.flags = {
  ...SchemaCommand.flags,
  retain: Flags.boolean({
    description:
      "Retain .fsl files in the target directory that are not part of the database schema",
    default: false,
  }),
  // NB: Required as a flag because it will become optional eventually,
  //     once project configuration is implemented.
  dir: Flags.string({
    required: true,
    description: "The target directory",
  }),
};
module.exports = PullSchemaCommand;
