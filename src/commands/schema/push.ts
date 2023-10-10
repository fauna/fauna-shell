import SchemaCommand from "../../lib/schema-command";
import fetch from "node-fetch";
import { Flags, ux } from "@oclif/core";

export default class PushSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
  };

  static description = "Push the current project's .fsl files to Fauna.";

  static examples = ["$ fauna schema push --dir schemas/myschema"];

  async confirm(msg: string): Promise<boolean> {
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
      const { url, secret } = await this.fetchsetup();
      if (this.flags?.force) {
        // Just push.
        const res = await fetch(new URL("/schema/1/update?force=true", url), {
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
        const res = await fetch(new URL("/schema/1/validate?force=true", url), {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: this.body(files),
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }
        let msg = "Accept and push changes?";
        if (json.diff) {
          this.log(`Proposed diff:\n`);
          this.log(json.diff);
        } else {
          this.log("No logical changes.");
          msg = "Push file contents anyway?";
        }
        if (await this.confirm(msg)) {
          const res = await fetch(
            new URL(`/schema/1/update?version=${json.version}`, url),
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
