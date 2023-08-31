const FaunaCommand = require("./fauna-command.js");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

class SchemaCommand extends FaunaCommand {
  static flags = (() => {
    // Remove flags that don't make sense.
    const { graphqlHost, graphqlPort, ...rest } = FaunaCommand.flags;
    return rest;
  })();

  async fetchsetup() {
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient();

    return {
      urlbase: `${scheme ?? "https"}://${domain}${port ? `:${port}` : ""}`,
      secret: secret,
    };
  }

  // Helper to construct form data for a collection of files, as
  // returned by `gather`.
  body(files) {
    const fd = new FormData();
    for (const file of files) {
      fd.append(file.name, Buffer.from(file.content));
    }
    return fd;
  }

  // Gathers all FSL files in the directory rooted at `basedir`.
  // Fails the command if the number or total size of files is
  // too large.
  async gather(basedir) {
    const FILE_LIMIT = 256;
    const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;

    var totalsize = 0;
    const go = (rel, curr) => {
      const names = fs.readdirSync(path.join(basedir, rel));
      const subdirs = [];
      for (const n of names) {
        const fp = path.join(basedir, rel, n);
        const relp = path.join(rel, n);
        const isDir = fs.statSync(fp).isDirectory();
        if (n.endsWith(".fsl") && !isDir) {
          const content = fs.readFileSync(fp);
          totalsize += content.length;
          if (totalsize > FILESIZE_LIMIT_BYTES) {
            this.error(
              `Too many bytes: at most ${FILESIZE_LIMIT_BYTES} may be pushed`
            );
          }
          curr.push({ name: relp, content: content });
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

module.exports = SchemaCommand;
