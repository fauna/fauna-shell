import FaunaCommand from "./fauna-command";
import * as fs from "fs";
import * as path from "path";
import { Flags } from "@oclif/core";
import { dirExists, dirIsWriteable } from "./file-util";

type File = {
  name: string;
  content: Buffer;
};

export default abstract class SchemaCommand extends FaunaCommand {
  static flags = {
    dir: Flags.string({
      description:
        "The directory of .fsl files to push. Defaults to the directory of `.fauna-project`",
      required: false,
    }),
    ...FaunaCommand.flags,
  };

  async fetchsetup() {
    const { connectionOptions } = await this.getClient();

    return {
      url: connectionOptions.url,
      secret: connectionOptions.secret.buildSecret(),
    };
  }

  dir = "";

  async init() {
    await super.init();

    if (this.flags?.dir !== undefined) {
      this.dir = this.flags.dir;
    } else if (this.shellConfig?.projectPath !== undefined) {
      if (this.shellConfig.projectConfig?.schemaDir !== undefined) {
        this.dir = path.join(
          this.shellConfig.projectPath,
          this.shellConfig.projectConfig.schemaDir
        );
      } else {
        this.dir = this.shellConfig.projectPath;
      }
      if (!dirExists(this.dir)) {
        this.error(`The project fsl directory: ${this.dir} does not exist.`);
      } else if (!dirIsWriteable(this.dir)) {
        this.error(`The project fsl directory: ${this.dir} is not writeable.`);
      }
    } else {
      this.error(
        "No project found. Create a project with `fauna project init`."
      );
    }
  }

  // Helper to construct form data for a collection of files, as
  // returned by `gather`.
  body(files: File[]) {
    const fd: Record<string, string> = {};
    for (const file of files) {
      fd[file.name] = file.content.toString();
    }
    const Readable = require("stream").Readable;
    const s = new Readable();
    s.push(JSON.stringify(fd));
    s.push(null);
    return s;
  }

  // Reads the files using their relative-to-`basedir` paths and returns their
  // contents paired with the relative path.
  // Fails if the total size of the files is too large.
  read(relpaths: string[]) {
    const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;
    const curr = [];
    var totalsize = 0;
    for (const relp of relpaths) {
      const fp = path.join(this.dir, relp);
      const content = fs.readFileSync(fp);
      totalsize += content.length;
      if (totalsize > FILESIZE_LIMIT_BYTES) {
        this.error(
          `Too many bytes: tool accepts at most ${FILESIZE_LIMIT_BYTES}`
        );
      }
      curr.push({ name: relp, content: content });
    }
    return curr;
  }

  // Gathers all FSL files in the directory rooted at `basedir` and returns a
  // list of relative paths.
  // Fails if there are too many files.
  gatherRelativeFSLFilePaths(): string[] {
    const FILE_LIMIT = 256;
    const go = (rel: string, curr: string[]) => {
      const names = fs.readdirSync(path.join(this.dir, rel));
      const subdirs = [];
      for (const n of names) {
        const fp = path.join(this.dir, rel, n);
        const relp = path.join(rel, n);
        const isDir = fs.statSync(fp).isDirectory();
        if (n.endsWith(".fsl") && !isDir) {
          curr.push(relp);
        }
        if (isDir) {
          subdirs.push(relp);
        }
      }
      for (const reldir of subdirs) {
        curr.concat(go(reldir, curr));
      }
      return curr;
    };
    const files = go("", []);
    if (files.length > FILE_LIMIT) {
      this.error(`Too many files: ${files.length} > ${FILE_LIMIT}`);
    }
    return files;
  }
}
