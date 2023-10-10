const SchemaCommand = require("../../lib/schema-command.js").default;
const fetch = require("node-fetch");
const { Flags, ux } = require("@oclif/core");

class PushSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
  };

  async confirm(msg) {
    const resp = await ux.prompt(msg, {
      default: "no",
    });
    if (["yes", "y"].includes(resp.toLowerCase())) {
      return true;
    }
    if (["no", "n"].includes(resp.toLowerCase())) {
      return false;
    }
    console.log("Please type 'yes' or 'no'");
    return this.confirm(msg);
  }

  async run() {
    const fps = this.gather();
    const files = this.read(fps);
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
        let msg = "Accept and push changes?"
        if (json.diff) {
          this.log(`Proposed diff:\n`);
          this.log(json.diff);
        } else {
          this.log("No logical changes.");
          msg = "Push file contents anyway?"
        }
        if (await this.confirm(msg)) {
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
          this.log("Push cancelled");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}

PushSchemaCommand.description = "Push the current project's .fsl files to Fauna.";

PushSchemaCommand.examples = ["$ fauna schema push --dir schemas/myschema"];

module.exports = PushSchemaCommand;
