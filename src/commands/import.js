const fs = require("fs");

const { Flags } = require("@oclif/core");
const FaunaCommand = require("../lib/fauna-command.js");
const StreamJson = require("../lib/json-stream");
const faunadb = require("faunadb");
const { pipeline } = require("stream");
const p = require("path");
const q = faunadb.query;
const getFaunaImportWriter = require("../lib/fauna-import-writer");
const { parse } = require("csv-parse");
const { ImportLimits } = require("../lib/import-limits");

class ImportCommand extends FaunaCommand {
  supportedExt = [".csv", ".json", ".jsonl"];

  isDir(path) {
    return fs.lstatSync(path).isDirectory();
  }

  async run() {
    const { db, path } = this.flags;
    const { client } = await (db
      ? this.ensureDbScopeClient(db)
      : this.getClient());
    this.client = client;

    this.log(`Database${db ? `'${db}'` : ""} connection established`);

    let importFn;
    if (this.isDir(path)) {
      importFn = this.importDir;
    } else {
      importFn = this.importFile;
    }

    const progressTracker = { totalRows: 0, numberFailedRows: 0 };

    return importFn
      .call(this, path, progressTracker)
      .catch((error) => this.handleError(error));
  }

  async importDir(path, progressTracker) {
    const files = fs.readdirSync(path);

    // check if folder size is approximately greater than 10GB
    if (
      this.calculateFolderSize(path, files) > ImportLimits.maximumImportSize()
    ) {
      throw new Error(
        `Folder (${path}) size is greater than 10GB, can't proceed with the import`
      );
    }

    const failedFiles = [];

    if (this.flags.collection) {
      try {
        await this.ensureCollection({ collection: this.flags.collection });
      } catch (e) {
        throw new Error(e.message);
      }
    }

    for (const file of files) {
      const subPath = p.resolve(path, file);
      if (this.isDir(subPath)) {
        const warning = `"${file}" subdirectory is skipped from processing`;
        failedFiles.push({ file, warning });
        this.warn(warning);
        continue;
      }
      let localProgressTracker = { totalRows: 0, numberFailedRows: 0 };
      try {
        await this.importFile(subPath, localProgressTracker);
        if (this.flags.collection) {
          this.flags.append = true;
        }
      } catch (e) {
        const warning = e.message ? e.message : e;
        failedFiles.push({ file, warning });
        this.warn(warning);
      } finally {
        progressTracker.totalRows += localProgressTracker.totalRows;
        progressTracker.numberFailedRows +=
          localProgressTracker.numberFailedRows;
      }
    }

    this.log("\n\nImport completed");
    if (failedFiles.length > 0) {
      failedFiles.forEach((failed) =>
        this.warn(`${failed.file} => ${failed.warning}`)
      );
      this.error(
        `${
          failedFiles.length
        } files failed to import. Inspect each file message for the reason. ${
          progressTracker.numberFailedRows
        } rows/object failed to import. ${
          progressTracker.totalRows - progressTracker.numberFailedRows
        } rows/object succeeded. (These numbers don't account for files that failed to be read, were badly formatted, or had an invalid extension)`
      );
    } else {
      this.success(
        `All files completed. ${progressTracker.totalRows} rows/object imported.`
      );
    }
  }

  async importFile(path, progressTracker) {
    // check if file size is approximately greater than 10GB
    if (this.calculateFileSize(path) > ImportLimits.maximumImportSize()) {
      throw new Error(
        `File (${path}) size is greater than 10GB, can't proceed with the import`
      );
    }

    let { collection } = this.flags;
    const source = this.parseFileName(path);
    if (!collection) {
      collection = source.name;
    }
    await this.dataImport({ source, collection, path, progressTracker });
    if (progressTracker.numberFailedRows > 0) {
      this.error(
        `File import from ${path} to ${collection} incomplete. ${
          progressTracker.numberFailedRows
        } rows/object failed to import. ${
          progressTracker.totalRows - progressTracker.numberFailedRows
        } rows/object succeeded`
      );
    } else {
      this.success(
        `Import from ${path} to ${collection} completed. ${progressTracker.totalRows} rows/object imported.`
      );
    }
  }

  calculateFileSize(path) {
    const stats = fs.statSync(path);
    return stats.size / (1024 * 1024);
  }

  calculateFolderSize(path, files) {
    let folderSize = 0;
    for (const file of files) {
      let filePath = p.join(path, file);
      folderSize += this.calculateFileSize(filePath);
    }
    return folderSize;
  }

  parseFileName(path) {
    const { name, ext } = p.parse(p.basename(path));

    if (!this.supportedExt.includes(ext)) {
      throw this.error(`File (${path}) extension isn't supported`);
    }
    return { name, ext, path };
  }

  async dataImport({ source, collection, path, progressTracker }) {
    await this.ensureCollection({
      collection,
    });

    return new Promise((resolve, reject) => {
      pipeline(
        fs.createReadStream(source.path, { highWaterMark: 500000 }),
        this.getTransformStreamStrategy(source.ext, this.flags),
        getFaunaImportWriter(
          source.ext === ".csv" ? this.flags.type : [],
          this.client,
          collection,
          path,
          progressTracker,
          {
            isDryRun: Boolean(this.flags["dry-run"]),
            logger: (msg) => this.warn(msg),
          }
        ),
        (error) => {
          if (error) return reject(error);
          resolve();
        }
      );
    });
  }

  getTransformStreamStrategy(extension, flags) {
    let strategies = {
      ".csv": () =>
        parse({
          columns: true,
          /* eslint-disable camelcase */
          relax_column_count_less: Boolean(flags["allow-short-rows"]),
          skip_empty_lines: true,
          /* eslint-enable camelcase */
          cast: function (value, context) {
            if (
              value === "" &&
              !context.quoting &&
              flags["treat-empty-csv-cells-as"] === "null"
            ) {
              return null;
            }
            return value;
          },
        }),
      ".json": () => StreamJson.withParser(),
      ".jsonl": () => StreamJson.withParser(),
    };
    return strategies[extension]();
  }

  handleError(error) {
    if (error instanceof faunadb.errors.FaunaHTTPError) {
      return this.error(
        `Error: ${
          error.faunaError
            ? error.faunaError.message
            : error.requestResult.responseRaw
        }`,
        { exit: false }
      );
    }
    if (error instanceof Error) {
      return this.error(error.message);
    }

    if (Array.isArray(error)) {
      this.error(`\r\n\t${error.join("\r\n\t")}`);
    }

    this.error(error);
  }

  createConditionallyExpr(collection, isDryRun) {
    if (isDryRun) {
      return {};
    } else {
      return q.If(
        q.Var("isCollectionExists"),
        "",
        q.CreateCollection({ name: collection })
      );
    }
  }

  async ensureCollection({ collection }) {
    const result = await this.client
      .query(
        q.Let(
          {
            ref: q.Collection(collection),
            isCollectionExists: q.Exists(q.Var("ref")),
            collection: this.createConditionallyExpr(
              collection,
              Boolean(this.flags["dry-run"])
            ),
            isEmpty: q.If(
              q.Var("isCollectionExists"),
              q.IsEmpty(q.Documents(q.Var("ref"))),
              true
            ),
          },
          { ref: q.Var("ref"), isEmpty: q.Var("isEmpty") }
        )
      )
      .catch((err) =>
        Promise.reject(
          err.requestResult ? err.requestResult.responseRaw : err.message
        )
      );

    if (!result.isEmpty && !this.flags.append) {
      return Promise.reject(
        new Error(
          `${result.ref} is not empty. Add '--append' to allow append data for non empty collection`
        )
      );
    }
  }
}

ImportCommand.description = "Import data to Fauna";

ImportCommand.examples = [
  "You can combine the options in any manner of you're choosing (although type translations cannot be applied to JSON or JSONL files). Below are examples.",
  "\n ... File import examples",
  "",
  "\nImport a file into a new collection - given the same name as the file:",
  "$ fauna import --path ./collection_name.csv",
  "\nAppend a file into a pre-existing collection - having the same name as the file:",
  "$ fauna import --append --path ./collection.csv",
  '\nImport a file into a new collection named "SampleCollection" in the child database "sampleDB":',
  "$ fauna import --db=sampleDB --collection=SampleCollection --path ./datafile.csv",
  '\nImport a file into a new collection named "SampleCollection" in the child database "sampleDB":',
  "$ fauna import --type=iso8601_date::dateString --type=hdr2::number --type=hdrX::bool --path ./collection.csv",
  "",
  " ... Directory import examples",
  "",
  'Import a directory - creating a new collection "SampleCollection" with data from every file in the directory:',
  "$ fauna import --path ./my_directory --collection=SampleCollection",
  '\nImport a directory - creating appending to the pre-existing collection "SampleCollection" with data from every file in the directory:',
  "$ fauna import --path ./my_directory --collection=SampleCollection --append",
  "\nImport a directory - creating creating a new collection named after the file name of each file:",
  "$ fauna import --path ./my_directory",
  "\nImport a directory - creating appending to pre-existing collections named after the file name of each file:",
  "$ fauna import --path ./my_directory --append",
];

const { graphqlHost, graphqlPort, ...commonFlags } = FaunaCommand.flags;

ImportCommand.flags = {
  path: Flags.string({
    required: true,
    description:
      "Path to .csv/.json file, or path to folder containing .csv/.json files.\
 if the path is to a folder, sub-folders will be skipped.",
  }),
  db: Flags.string({
    description:
      "Child database name; imported documents are stored in this database",
  }),
  collection: Flags.string({
    description:
      "Collection name. When not specified, the collection name is the filename.",
    required: false,
  }),
  type: Flags.string({
    description: `Column type casting - converts the column value to a Fauna type. Available only in CSVs; will be ignored in json/jsonl inputs. Null values will be treated as null and no conversion will be performed.\
\nFormat: <column>::<type>\n<column>: the name of the column to cast values\
\n<type>: one of\
\n\t'number' - convert string to number\
\n\t'bool' - convert 'true', 't', 'yes', or '1' to true and all other values to false (saving null which will be treated as null)\
\n\t'dateString' - convert a ISO-8601 or RFC-2822 date string to a Fauna Time; will make a best effort on other formats,\
\n\t'dateEpochMillis' - converts milliseconds since the epoch to a Fauna Time\
\n\t'dateEpochSeconds' - converts seconds since the epoch to a Fauna Time`,
    multiple: true,
  }),
  append: Flags.boolean({
    description: "Allows appending documents to a non-empty collection",
  }),
  "allow-short-rows": Flags.boolean({
    description: "Allows rows which are shorter than the number of headers",
  }),
  "dry-run": Flags.boolean({
    description:
      "Dry run the import - committing no documents to Fauna but converting all items to Fauna's format and applying all requested --type conversions. \
Enables you to detect issues with your file(s) before writing to your collection(s).",
  }),
  "treat-empty-csv-cells-as": Flags.string({
    description:
      "Treat empty csv cells as empty strings or null, default is null.",
    options: ["empty", "null"],
    default: "null",
  }),
  ...commonFlags,
};

module.exports = ImportCommand;
