import SchemaCommand from "../../lib/schema-command";
import { bold, colorParam, hasColor, reset } from "../../lib/color";
import { Flags } from "@oclif/core";

export default class DiffSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    active: Flags.boolean({
      description: "Compare the local schema to the active schema.",
      default: false,
    }),
  };

  static description = "Print the diff between local and remote schema.";
  static examples = [
    "$ fauna schema diff",
    "$ fauna schema diff --dir schemas/myschema",
  ];

  async run() {
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    const { url, secret } = await this.fetchsetup();

    let version: string | undefined = undefined;
    let status: string = "";

    try {
      const res = await fetch(new URL(`/schema/1/staged/status`, url), {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
        // https://github.com/nodejs/node/issues/46221
        // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
        // @ts-expect-error-next-line
        duplex: "half",
      });

      const json = await res.json();
      if (json.error) {
        this.error(json.error.message);
      }

      version = json.version;
      status = json.status;

      if (json.status === "none" && this.flags?.active) {
        this.error(
          "There is no staged schema, so passing `--active` does nothing"
        );
      }
    } catch (err) {
      this.error(err);
    }

    try {
      const params = new URLSearchParams({
        ...(hasColor() ? { color: colorParam() } : {}),
        staged: this.flags?.active ? "false" : "true",
        ...(version !== undefined ? { version } : { force: "true" }),
      });
      const res = await fetch(new URL(`/schema/1/validate?${params}`, url), {
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

      if (status !== "none") {
        if (this.flags?.active) {
          this.log(
            `Differences between the ${bold()}local${reset()} schema and the ${bold()}remote, active${reset()} schema:`
          );
        } else {
          this.log(
            `Differences between the ${bold()}local${reset()} schema and the ${bold()}remote, staged${reset()} schema:`
          );
        }
      } else {
        this.log(
          `Differences between the ${bold()}local${reset()} schema and the ${bold()}remote${reset()} schema:`
        );
      }
      this.log(json.diff ? json.diff : "No schema differences");
    } catch (err) {
      this.error(err);
    }
  }
}
