import { confirm } from "@inquirer/prompts";
import SchemaCommand from "../../lib/schema-command";
import { Flags } from "@oclif/core";

export default class PushSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
  };

  static description = "Push the current project's .fsl files to Fauna.";

  static examples = [
    "$ fauna schema push",
    "$ fauna schema push --dir schemas/myschema",
  ];

  async run() {
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    try {
      const { url, secret } = await this.fetchsetup();
      if (this.flags?.force) {
        // Just push.
        const res = await fetch(new URL("/schema/1/update?force=true", url), {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: this.body(files),
          // https://github.com/nodejs/node/issues/46221
          // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
          // @ts-expect-error-next-line
          duplex: "half",
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
          // @ts-expect-error-next-line
          duplex: "half",
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }
        let message = "Accept and push changes?";
        if (json.diff) {
          this.log(`Proposed diff:\n`);
          this.log(json.diff);
        } else {
          this.log("No logical changes.");
          message = "Push file contents anyway?";
        }
        const confirmed = await confirm({
          message,
          default: false,
        });
        if (confirmed) {
          const res = await fetch(
            new URL(`/schema/1/update?version=${json.version}`, url),
            {
              method: "POST",
              headers: { AUTHORIZATION: `Bearer ${secret}` },
              body: this.body(files),
              // @ts-expect-error-next-line
              duplex: "half",
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
