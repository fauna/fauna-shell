import SchemaCommand from "../../lib/schema-command";
import fetch from "node-fetch";

export default class DiffSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
  };

  static description = "Print the diff between local and remote schema.";
  static examples = ["$ fauna schema diff --dir schemas/myschema"];

  async run() {
    const fps = this.gather();
    const files = this.read(fps);
    try {
      const { urlbase, secret } = await this.fetchsetup();
      const res = await fetch(`${urlbase}/schema/1/validate?force=true`, {
        method: "POST",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
        body: this.body(files),
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
