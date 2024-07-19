import SchemaCommand from "../../lib/schema-command";

export default class DiffSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
  };

  static description = "Print the diff between local and remote schema.";
  static examples = [
    "$ fauna schema diff",
    "$ fauna schema diff --dir schemas/myschema",
  ];

  async run() {
    const fps = this.gatherRelativeFSLFilePaths();
    const files = this.read(fps);
    try {
      const { url, secret } = await this.fetchsetup();
      const res = await fetch(new URL("/schema/1/validate?force=true", url), {
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
      this.log(json.diff ? json.diff : "No schema differences");
    } catch (err) {
      this.error(err);
    }
  }
}
