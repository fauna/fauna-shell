import { confirm } from "@inquirer/prompts";
import SchemaCommand from "../../lib/schema-command";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Flags } from "@oclif/core";

export default class PullSchemaCommand extends SchemaCommand {
  static flags = {
    ...SchemaCommand.flags,
    delete: Flags.boolean({
      description:
        "Delete .fsl files in the target directory that are not part of the database schema",
      default: false,
    }),
  };

  static description =
    "Pull a database schema's .fsl files into the current project.";

  static examples = ["$ fauna schema pull"];

  async run() {
    const { url, secret } = await this.fetchsetup();

    try {
      // Gather remote schema files to download.
      const filesres = await fetch(new URL("/schema/1/files", url), {
        method: "GET",
        headers: { AUTHORIZATION: `Bearer ${secret}` },
      });
      const filesjson = await filesres.json();
      if (filesjson.error) {
        this.error(filesjson.error.message);
      }
      // Sort for consistent order. It's nice for tests.
      const filenames = filesjson.files
        .map((file: any) => file.filename)
        .filter((name: string) => name.endsWith(".fsl"))
        .sort();

      // Gather local .fsl files to overwrite or delete.
      const existing = this.gather();

      // Summarize file changes.
      const adds = [];
      const overwrites = [];
      for (const fn of filenames) {
        if (existing.includes(fn)) {
          overwrites.push(fn);
        } else {
          adds.push(fn);
        }
      }
      const deletes = [];
      for (const fn of existing) {
        if (!filenames.includes(fn)) {
          deletes.push(fn);
        }
      }
      deletes.sort();

      console.log("Pull makes the following changes:");
      if (this.flags?.delete) {
        for (const deleteme of deletes) {
          console.log(`delete:    ${deleteme}`);
        }
      }
      for (const add of adds) {
        console.log(`add:       ${add}`);
      }
      for (const overwrite of overwrites) {
        console.log(`overwrite: ${overwrite}`);
      }

      if (this.flags?.delete) {
        // Delete extra .fsl files.
        for (const deleteme of deletes) {
          fs.unlinkSync(path.join(this.dir, deleteme));
        }
      }

      const confirmed = await confirm({
        message: "Accept the changes?",
        default: false,
      });
      if (confirmed) {
        for (const filename of filenames) {
          const fileres = await fetch(
            new URL(`/schema/1/files/${filename}`, url),
            {
              method: "GET",
              headers: { AUTHORIZATION: `Bearer ${secret}` },
            }
          );
          const filejson = await fileres.json();
          if (filejson.error) {
            this.error(filejson.error.message);
          }
          const fp = path.join(this.dir, filename);
          fs.mkdirSync(path.dirname(fp), { recursive: true });
          fs.writeFileSync(fp, filejson.content);
        }
      } else {
        this.log("Change cancelled");
      }
    } catch (err) {
      this.error(err);
    }
  }
}
