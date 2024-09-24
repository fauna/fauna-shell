import SchemaCommand from "../../lib/schema-command";
import { colorParam, hasColor } from "../../lib/color";

export default class StatusSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
  };

  static description = "Print the staged schema status.";
  static examples = ["$ fauna schema status"];

  async run() {
    try {
      const { url, secret } = await this.fetchsetup();

      const params = new URLSearchParams({
        ...(hasColor() ? { color: colorParam() } : {}),
        diff: "true",
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

      const json = await res.json();
      if (json.error) {
        this.error(json.error.message);
      }

      this.log(json.diff);
    } catch (err) {
      console.log(err);
      this.error(err);
    }
  }
}
