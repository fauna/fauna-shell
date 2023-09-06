const SchemaCommand = require("../../lib/schema-command.js");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Flags, ux } = require("@oclif/core");

class PullSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    delete: Flags.boolean({
      description:
        "Delete .fsl files in the target directory that are not part of the database schema",
      default: false,
    }),
    // NB: Required as a flag because it will become optional eventually,
    //     once project configuration is implemented.
    dir: Flags.string({
      required: true,
      description: "The target directory",
    }),
  };

  async confirm() {
    const resp = await ux.prompt("Accept the changes?", {
      default: "no",
    });
    if (["yes", "y"].includes(resp.toLowerCase())) {
      return true;
    }
    if (["no", "n"].includes(resp.toLowerCase())) {
      return false;
    }
    console.log("Please type 'yes' or 'no'");
    return this.confirm();
  }

  async run() {
    const { urlbase, secret } = await this.fetchsetup();

    const dir = this.flags.dir;

    try {
      // Gather remote schema files to download.
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

      // Gather local .fsl files to overwrite or delete.
      const existing = this.gather(dir);

      // Summarize file changes.
      const adds = [];
      const overwrites = [];
      for (const fn of filenames) {
        if (existing.includes(fn)) {
          overwrites.push(fn);
        } else {
          adds.push(fn);
        }
      }
      const deletes = [];
      for (const fn of existing) {
        if (!filenames.includes(fn)) {
          deletes.push(fn);
        }
      }
      deletes.sort();

      console.log("Pull makes the following changes:");
      if (this.flags.delete) {
        for (const deleteme of deletes) {
          console.log(`delete:    ${deleteme}`);
        }
      }
      for (const add of adds) {
        console.log(`add:       ${add}`);
      }
      for (const overwrite of overwrites) {
        console.log(`overwrite: ${overwrite}`);
      }

      if (this.flags.delete) {
        // Delete extra .fsl files.
        for (const deleteme of deletes) {
          fs.unlinkSync(path.join(dir, deleteme));
        }
      }

      if (await this.confirm()) {
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
      } else {
        this.log("Change cancelled");
      }
    } catch (err) {
      this.error(err);
    }
  }
}

PullSchemaCommand.description =
  "Pull a database schema's .fsl files into a directory";

PullSchemaCommand.examples = ["$ fauna schema pull --dir schemas/myschema"];

module.exports = PullSchemaCommand;
