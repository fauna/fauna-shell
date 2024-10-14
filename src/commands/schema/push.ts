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
    active: Flags.boolean({
      description:
        "Skip staging the schema and make the schema active immediately. This will cause indexes to be temporarily unavailable.",
      default: false,
    }),
  };

  static description = "Push the current project's .fsl files to Fauna.";

  static examples = [
    "$ fauna schema push",
    "$ fauna schema push --dir schemas/myschema",
    "$ fauna schema push --active",
  ];

  async run() {
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    try {
      const { url, secret } = await this.fetchsetup();

      const statusres = await fetch(new URL(`/schema/1/staged/status`, url), {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
        // https://github.com/nodejs/node/issues/46221
        // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
        // @ts-expect-error-next-line
        duplex: "half",
      });
      const statusjson = await statusres.json();
      if (statusjson.error) {
        this.error(statusjson.error.message);
      }

      if (statusjson.status !== "none" && this.flags?.active) {
        this.error(
          "Cannot skip a staged push while there is a staged schema.\n" +
            "Use `fauna schema status` to check the staged schema."
        );
      }

      // Double negatives are confusing.
      const isStagedPush = !this.flags?.active;

      if (this.flags?.force) {
        const params = new URLSearchParams({
          force: "true", // Just push.
          staged: isStagedPush ? "true" : "false",
        });

        // This is how MDN says to do it for some reason.
        const path = new URL(`/schema/1/update?${params}`, url);
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

        let message = isStagedPush
          ? "Stage the above changes?"
          : "Push the above changes?";
        if (json.diff) {
          this.log("Proposed diff:\n");
          this.log(json.diff);
        } else {
          this.log("No logical changes.");
          message = "Stage the file contents anyway?";
        }
        if (!isStagedPush) {
          this.log(
            "Note: Any modified indexes will be temporarily unavailable while building."
          );
        }
        this.log("(use `fauna schema diff` to show the complete diff)");
        const confirmed = await confirm({
          message,
          default: false,
        });

        if (confirmed) {
          const params = new URLSearchParams({
            version: json.version,
            staged: isStagedPush ? "true" : "false",
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
