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

  // Reads the files using their relative-to-`basedir` paths and returns their
  // contents paired with the relative path.
  // Fails if the total size of the files is too large.
  read(basedir, relpaths) {
    const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;
    const curr = [];
    var totalsize = 0;
    for (const relp of relpaths) {
      const fp = path.join(basedir, relp);
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
  gather(basedir) {
    const FILE_LIMIT = 256;
    const go = (rel, curr) => {
      const names = fs.readdirSync(path.join(basedir, rel));
      const subdirs = [];
      for (const n of names) {
        const fp = path.join(basedir, rel, n);
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

module.exports = SchemaCommand;
