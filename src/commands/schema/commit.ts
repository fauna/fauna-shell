import { confirm } from "@inquirer/prompts";
import SchemaCommand from "../../lib/schema-command";
import { Flags } from "@oclif/core";
import { colorParam, hasColor } from "../../lib/color";

export default class CommitSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
  };

  static description = "Commits the currently staged schema.";

  static examples = ["$ fauna schema commit"];

  async run() {
    try {
      const { url, secret } = await this.fetchsetup();
      if (this.flags?.force) {
        const params = new URLSearchParams({
          force: "true", // Just commit, don't pass a schema version through.
        });

        const path = new URL(`/schema/1/staged/commit?${params}`, url);
        const res = await fetch(path, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          // https://github.com/nodejs/node/issues/46221
          // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
          // @ts-expect-error-next-line
          duplex: "half",
        });

        const json = await res.json();
        if (json.error) {
          this.error(json.error?.message ?? json.error);
        }

        this.log("Schema has been committed");
      } else {
        // Show status to confirm.
        const params = new URLSearchParams({
          ...(hasColor() ? { color: colorParam() } : {}),
          diff: "true",
        });
        const res = await fetch(
          new URL(`/schema/1/staged/status?${params}`, url),
          {
            method: "GET",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            // @ts-expect-error-next-line
            duplex: "half",
          }
        );

        const json = await res.json();
        if (json.error) {
          this.error(json.error.message);
        }

        if (json.status === "none") {
          this.error("There is no staged schema to commit");
        }

        this.log(json.diff);

        if (json.status !== "ready") {
          this.error("Schema is not ready to be committed");
        }

        const confirmed = await confirm({
          message: "Accept and commit these changes?",
          default: false,
        });

        if (confirmed) {
          const params = new URLSearchParams({ version: json.version });

          const path = new URL(`/schema/1/staged/commit?${params}`, url);
          const res = await fetch(path, {
            method: "POST",
            headers: { AUTHORIZATION: `Bearer ${secret}` },
            // @ts-expect-error-next-line
            duplex: "half",
          });

          const json0 = await res.json();
          if (json0.error) {
            this.error(json0.error.message);
          }

          this.log("Schema has been committed");
        } else {
          this.log("Commit cancelled");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}
