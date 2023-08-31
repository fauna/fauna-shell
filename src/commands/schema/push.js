const SchemaCommand = require("../../lib/schema-command.js");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Flags, ux } = require("@oclif/core");
const FormData = require("form-data");

const FILE_LIMIT = 256;
const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;

class PushSchemaCommand extends SchemaCommand {
  async confirm() {
    const resp = await ux.prompt("Accept and push the changes?", {
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
    // Recursively gather all .fsl files.
    const basedir = this.flags.dir;
    var totalsize = 0;
    const files = [];
    const go = (rel) => {
      const names = fs.readdirSync(path.join(basedir, rel));
      const subdirs = [];
      for (const n of names) {
        const fp = path.join(basedir, rel, n);
        const relp = path.join(rel, n);
        const isDir = fs.statSync(fp).isDirectory();
        if (n.endsWith(".fsl") && !isDir) {
          const content = fs.readFileSync(fp);
          totalsize += content.length;
          if (totalsize > FILESIZE_LIMIT_BYTES) {
            this.error(
              `Too many bytes: at most ${FILESIZE_LIMIT_BYTES} may be pushed`
            );
          }
          files.push({ name: relp, content: content });
        }
        if (isDir) {
          subdirs.push(relp);
        }
      }
      for (const reldir of subdirs) {
        go(reldir);
      }
    };
    go("");
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
      const { urlbase, secret } = await this.fetchsetup();
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
        const res = await fetch(`${urlbase}/schema/1/validate?force=true`, {
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
        if (await this.confirm()) {
          const res = await fetch(
            `${urlbase}/schema/1/update?version=${json.version}`,
            {
              method: "POST",
              headers: { AUTHORIZATION: `Bearer ${secret}` },
              body: body(),
            }
          );
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
};
module.exports = PushSchemaCommand;
