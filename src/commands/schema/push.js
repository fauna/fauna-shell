const FaunaCommand = require("../../lib/fauna-command.js");
const fetch = require("node-fetch");
const fs = require("fs");
const { Args, Flags, ux } = require("@oclif/core");
const FormData = require("form-data");

class PushSchemaCommand extends FaunaCommand {
  async run() {
    const filename = this.args.filename;
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient();

    const content = fs.readFileSync(filename);
    const body = () => {
      const fd = new FormData();
      // Make a new buffer because we may use the data multiple times.
      fd.append(filename, Buffer.from(content));
      return fd;
    };

    try {
      if (this.flags.force) {
        // Just push.
        const res = await fetch(
          `${scheme}://${domain}:${port}/schema/1/update?force=true`,
          {
            method: "POST",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            body: body(),
          }
        );
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }
      } else {
        // Confirm diff, then push it.
        const res = await fetch(
          `${scheme}://${domain}:${port}/schema/1/validate`,
          {
            method: "POST",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            body: body(),
          }
        );
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
          return;
        }
        this.log(`Proposed diff for ${filename}:\n`);
        this.log(json.diff);
        if (await ux.confirm("Accept and push the changes?")) {
          const res = await fetch(
            `${scheme}://${domain}:${port}/schema/1/update?version=${json.version}`,
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

PushSchemaCommand.description = "Push a database schema file to Fauna";

PushSchemaCommand.examples = ["$ fauna schema push main.fsl"];

PushSchemaCommand.args = {
  filename: Args.string({
    required: true,
    description: "name of schema file",
  }),
};

PushSchemaCommand.flags = {
  ...FaunaCommand.flags,
  force: Flags.boolean({
    description: "Push the change without a diff check",
    default: false,
  }),
};
module.exports = PushSchemaCommand;
