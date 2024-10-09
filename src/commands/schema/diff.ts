import SchemaCommand from "../../lib/schema-command";
import { bold, colorParam, hasColor, reset } from "../../lib/color";
import { Args, Flags } from "@oclif/core";

type Target = "local" | "staged" | "active";

export default class DiffSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    text: Flags.boolean({
      description: "Display the text diff instead of the semantic diff.",
      default: false,
    }),
  };

  static args = {
    ...SchemaCommand.args,
    target: Args.string({
      description: "The target schema to compare against (active | staged).",
      required: false,
    }),
  };

  static description =
    "Print the diff between local schema and staged remote schema.";
  static examples = [
    "$ fauna schema diff",
    "$ fauna schema diff --dir schemas/myschema",
  ];

  async run() {
    const [source, target] = this.parseTarget();

    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    const { url, secret } = await this.fetchsetup();

    let version: string | undefined = undefined;
    let status: string = "";

    const diffKind = this.flags?.text ? "textual" : "semantic";

    try {
      const params = new URLSearchParams({
        ...(hasColor() ? { color: colorParam() } : {}),
        ...(target === "staged" ? { diff: diffKind } : {}),
      });
      const res = await fetch(
        new URL(`/schema/1/staged/status?${params}`, url),
        {
          method: "GET",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          // https://github.com/nodejs/node/issues/46221
          // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
          // @ts-expect-error-next-line
          duplex: "half",
        }
      );

      const statusJson = await res.json();
      if (statusJson.error) {
        this.error(statusJson.error.message);
      }

      version = statusJson.version;
      status = statusJson.status;

      if (target === "staged") {
        this.log(
          `Differences from the ${bold()}remote, active${reset()} schema to the ${bold()}remote, staged${reset()} schema:`
        );
        if (status === "none") {
          this.log("There is no staged schema present.");
        } else {
          this.log(statusJson.diff ? statusJson.diff : "No schema differences");
        }
      } else {
        const params = new URLSearchParams({
          ...(hasColor() ? { color: colorParam() } : {}),
          staged: source === "staged" ? "true" : "false",
          ...(version !== undefined ? { version } : { force: "true" }),
          diff: diffKind,
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

        if (status === "none") {
          this.log(
            `Differences from the ${bold()}remote${reset()} schema to the ${bold()}local${reset()} schema:`
          );
        } else if (source === "active") {
          this.log(
            `Differences from the ${bold()}remote, active${reset()} schema to the ${bold()}local${reset()} schema:`
          );
        } else {
          this.log(
            `Differences from the ${bold()}remote, staged${reset()} schema to the ${bold()}local${reset()} schema:`
          );
        }
        this.log(json.diff ? json.diff : "No schema differences");
      }
    } catch (err) {
      this.error(err);
    }
  }

  parseTarget(): [Target, Target] {
    const target: string = this.args?.target;

    if (!target) {
      return ["staged", "local"];
    }

    if (target === "active") {
      return ["active", "local"];
    } else if (target === "staged") {
      return ["active", "staged"];
    } else {
      // NB: `this.error` quits the program, so return `any` to make typescript happy.
      this.error("Invalid target. Expected: active or staged");
      return [] as any;
    }
  }
}
