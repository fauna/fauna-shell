import { confirm } from "@inquirer/prompts";
import SchemaCommand from "../../lib/schema-command";
import { Flags } from "@oclif/core";
import { colorParam, hasColor } from "../../lib/color";

export default class PushSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
    staged: Flags.boolean({
      description:
        "Stages the schema change, instead of applying it immediately",
      default: false,
    }),
  };

  static description = "Push the current project's .fsl files to Fauna.";

  static examples = [
    "$ fauna schema push",
    "$ fauna schema push --dir schemas/myschema",
    "$ fauna schema push --staged",
  ];

  async run() {
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    try {
      const { url, secret } = await this.fetchsetup();
      if (this.flags?.force) {
        const params = new URLSearchParams({
          force: "true", // Just push.
          staged: this.flags?.staged ? "true" : "false",
        });

        // This is how MDN says to do it for some reason.
        const path = new URL(`/schema/1/update?${params}`, url);
        const res = await fetch(path, {
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
          this.error(json.error?.message ?? json.error);
        }
      } else {
        // Confirm diff, then push it. `force` is set on `validate` so we don't
        // need to pass the last known schema version through.
        const params = new URLSearchParams({
          ...(hasColor() ? { color: colorParam() } : {}),
          force: "true",
          diff: "summary",
        });
        const path = new URL(`/schema/1/validate?${params}`, url);
        const res = await fetch(path, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: this.body(files),
          // @ts-expect-error-next-line
          duplex: "half",
        });
        const json = await res.json();
        if (json.error) {
          this.error(json.error?.message ?? json.error);
        }

        let message = "Accept and push changes?";
        if (json.diff) {
          this.log("Proposed diff:\n");
          this.log(json.diff);
        } else {
          this.log("No logical changes.");
          message = "Push file contents anyway?";
        }
        this.log("(use `fauna schema diff` to show the complete diff)");
        const confirmed = await confirm({
          message,
          default: false,
        });

        if (confirmed) {
          const params = new URLSearchParams({
            version: json.version,
            staged: this.flags?.staged ? "true" : "false",
          });

          const path = new URL(`/schema/1/update?${params}`, url);
          const res = await fetch(path, {
            method: "POST",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            body: this.body(files),
            // @ts-expect-error-next-line
            duplex: "half",
          });

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
