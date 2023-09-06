const SchemaCommand = require("../../lib/schema-command.js");
const fetch = require("node-fetch");
const { Flags, ux } = require("@oclif/core");

class PushSchemaCommand extends SchemaCommand {
  static flags = {
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
    const fps = this.gather(this.flags.dir);
    const files = this.read(this.flags.dir, fps);
    try {
      const { urlbase, secret } = await this.fetchsetup();
      if (this.flags.force) {
        // Just push.
        const res = await fetch(`${urlbase}/schema/1/update?force=true`, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: this.body(files),
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
          body: this.body(files),
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }
        if (!json.diff) {
          this.log("No changes to push");
          this.exit(0);
        }
        this.log(`Proposed diff:\n`);
        this.log(json.diff);
        if (await this.confirm()) {
          const res = await fetch(
            `${urlbase}/schema/1/update?version=${json.version}`,
            {
              method: "POST",
              headers: { AUTHORIZATION: `Bearer ${secret}` },
              body: this.body(files),
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

module.exports = PushSchemaCommand;
