const SchemaCommand = require("./schema-command.js");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Flags, ux } = require("@oclif/core");
const FormData = require("form-data");

const FILE_LIMIT = 256;
const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;

class PushSchemaCommand extends SchemaCommand {
  async run() {
    const { urlbase, secret } = await this.fetchsetup();
    const dir = this.flags.dir;
    const filenames = fs.readdirSync(dir);
    var totalsize = 0;
    const files = filenames
      .filter(
        (filename) =>
          filename.endsWith(".fsl") &&
          !fs.statSync(path.join(dir, filename)).isDirectory()
      )
      .map((filename) => {
        const content = fs.readFileSync(path.join(dir, filename));
        totalsize += content.length;
        if (totalsize > FILESIZE_LIMIT_BYTES) {
          this.error(
            `Too many bytes: at most ${FILESIZE_LIMIT_BYTES} may be pushed`
          );
        }
        return {
          name: filename,
          content: content,
        };
      });
    if (files.length > FILE_LIMIT) {
      this.error(`Too many files: ${files.length} > ${FILE_LIMIT}`);
    }
    const body = () => {
      const fd = new FormData();
      for (const file of files) {
        fd.append(file.name, Buffer.from(file.content));
      }
      return fd;
    };

    try {
      if (this.flags.force) {
        // Just push.
        const res = await fetch(`${urlbase}/schema/1/update?force=true`, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: body(),
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }
      } else {
        // Confirm diff, then push it.
        let vurl = `${urlbase}/schema/1/validate?force=true`;
        if (this.flags.version) {
          vurl = `${urlbase}/schema/1/validate?version=${this.flags.version}`;
        }
        const res = await fetch(vurl, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: body(),
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
          return;
        }
        this.log(`Proposed diff:\n`);
        this.log(json.diff);
        if (await ux.confirm("Accept and push the changes?")) {
          let purl = `${urlbase}/schema/1/update?version=${json.version}`;
          if (this.flags.version) {
            purl = `${urlbase}/schema/1/update?version=${this.flags.version}`;
          }
          const res = await fetch(purl, {
            method: "POST",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            body: body(),
          });
          const json0 = await res.json();
          if (json0.error) {
            this.error(json0.error.message);
          }
        } else {
          this.log("Change cancelled");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}

PushSchemaCommand.description = "Push a directory of .fsl files to Fauna";

PushSchemaCommand.examples = ["$ fauna schema push --dir schemas/myschema"];

PushSchemaCommand.flags = {
  ...SchemaCommand.flags,
  force: Flags.boolean({
    description: "Push the change without a diff or schema version check",
    default: false,
  }),
  // NB: Required as a flag because it will become optional eventually,
  //     once project configuration is implemented.
  dir: Flags.string({
    required: true,
    description: "The directory of .fsl files to push",
  }),
  version: Flags.string({
    required: false,
    description: "The schema version expected in the database",
  }),
};
module.exports = PushSchemaCommand;
