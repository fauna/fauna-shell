import SchemaCommand from "../../lib/schema-command";
import { bold, colorParam, hasColor, reset } from "../../lib/color";

export default class StatusSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
  };

  static description = "Print the staged schema status.";
  static examples = ["$ fauna schema status"];

  async run() {
    process.removeAllListeners("warning");

    const { url, secret } = await this.fetchsetup();
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);

    try {
      const statusParams = new URLSearchParams({
        ...(hasColor() ? { color: colorParam() } : {}),
        diff: "summary",
      });
      const statusRes = await fetch(
        new URL(`/schema/1/staged/status?${statusParams}`, url),
        {
          method: "GET",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          // https://github.com/nodejs/node/issues/46221
          // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
          // @ts-expect-error-next-line
          duplex: "half",
        }
      );

      const statusJson = await statusRes.json();
      if (statusJson.error) {
        this.error(statusJson.error.message);
      }

      const validateParams = new URLSearchParams({
        ...(hasColor() ? { color: colorParam() } : {}),
        diff: "summary",
        staged: "true",
        version: statusJson.version,
      });
      const validateRes = await fetch(
        new URL(`/schema/1/validate?${validateParams}`, url),
        {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: this.body(files),
          // https://github.com/nodejs/node/issues/46221
          // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
          // @ts-expect-error-next-line
          duplex: "half",
        }
      );

      const validateJson = await validateRes.json();

      if (statusJson.status === "none") {
        this.log(`Staged changes: ${bold()}none${reset()}`);
      } else {
        this.log(`Staged status: ${bold()}${statusJson.status}${reset()}`);
        if (statusJson.pending_summary !== "") {
          this.log(statusJson.pending_summary);
        }
        this.log("Staged changes:");
        this.log();
        this.log("  " + statusJson.diff.split("\n").join("\n  "));

        if (statusJson.status === "ready") {
          this.log("(use `fauna schema commit` to commit staged changes)");
        }
      }

      if (validateJson.error) {
        this.log(`Local changes:`);
        this.error(validateJson.error.message);
      } else {
        if (validateJson.diff === "") {
          this.log(`Local changes: ${bold()}none${reset()}`);
        } else {
          this.log(`Local changes:`);
          this.log();
          this.log("  " + validateJson.diff.split("\n").join("\n  "));

          this.log("(use `fauna schema diff` to display local changes)");
          this.log("(use `fauna schema push --staged` to stage local changes)");
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
}
