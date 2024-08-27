import { confirm } from "@inquirer/prompts";
import SchemaCommand from "../../lib/schema-command";
import { Flags } from "@oclif/core";

export default class CommitSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    force: Flags.boolean({
      description: "Push the change without a diff or schema version check",
      default: false,
    }),
  };

  static description = "Abandons the currently staged schema.";

  static examples = ["$ fauna schema abandon"];

  async run() {
    try {
      const { url, secret } = await this.fetchsetup();
      if (this.flags?.force) {
        const params = new URLSearchParams({
          force: "true", // Just abandon, don't pass a schema version through.
        });

        const path = new URL(`/schema/1/staged/abandon?${params}`, url);
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

        this.log("Schema has been abandonded");
      } else {
        // Show status to confirm.
        const { url, secret } = await this.fetchsetup();
        const res = await fetch(
          new URL("/schema/1/staged/status?diff=true", url),
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
          this.error("There is no staged schema to abandon");
        }

        this.log(json.diff);

        const confirmed = await confirm({
          message: "Abandon these changes?",
          default: false,
        });

        if (confirmed) {
          const params = new URLSearchParams({ version: json.version });

          const path = new URL(`/schema/1/staged/abandon?${params}`, url);
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

          this.log("Schema has been abandoned");
        } else {
          this.log("Abandon cancelled");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}
