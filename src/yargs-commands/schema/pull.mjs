import { container } from '../../cli.mjs'
import { commonQueryOptions } from '../../lib/command-helpers.mjs'

async function doPull(argv) {
  const logger = (await container.resolve("logger"))
  const gatherRelativeFSLFilePaths = container.resolve("gatherRelativeFSLFilePaths")
  const fetch = container.resolve("fetch")
  const confirm = container.resolve("confirm")
  const getSchemaFiles = container.resolve("getSchemaFiles")
  const getStagedSchemaStatus = container.resolve("getStagedSchemaStatus")

  const filesResponse = await getSchemaFiles({ argv })

  // Check if there's a staged schema, and require `--staged` if there is one.
  const statusResponse = await getStagedSchemaStatus({
    argv,
    params: { version: filesResponse.version },
    shouldThrow: false
  })

  if (statusResponse.status !== "none" && !argv.staged) {
    logger.stdout("There is a staged schema change. Use --staged to pull it.");
  } else if (statusResponse.status === "none" && argv.staged) {
    logger.stdout("There are no staged schema changes to pull.");
  }

  console.log(filesResponse.files)
  // Sort for consistent order. It's nice for tests.
  const filenames = filesResponse.files
  .map((file) => file.filename)
  .filter((name) => name.endsWith(".fsl"))
  .sort();

  // Gather local .fsl files to overwrite or delete.
  const existing = await gatherRelativeFSLFilePaths(argv.dir);

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
  if (argv.delete) {
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

  if (argv.delete) {
    // Delete extra .fsl files.
      for (const deleteme of deletes) {
        fs.unlinkSync(path.join(argv.dir, deleteme));
      }
  }

  const confirmed = await confirm({
    message: "Accept the changes?",
    default: false,
  });

  if (confirmed) {
    for (const filename of filenames) {
      const fileres = await fetch(
        new URL(`/schema/1/files/${encodeURIComponent(filename)}`, argv.url),
        {
          method: "GET",
          headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
        }
      );
      const filejson = await fileres.json();
      if (filejson.error) {
        logger.stderr(filejson.error.message);
      }
      const fp = path.join(argv.dir, filename);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, filejson.content);
    }
  } else {
    logger.stdout("Change cancelled");
  }
}

function buildPullCommand(yargs) {
  return yargs
  .options({
    ...commonQueryOptions,
    delete: {
      description: "Delete .fsl files in the target directory that are not part of the database schema",
      type: 'boolean',
      default: false,
    },
    staged: {
      description: "Pulls staged schema instead of the active schema",
      type: 'boolean',
      default: false,
    },
  })
  .example([
    ["$0 fauna schema pull"],
    ["$0 fauna schema pull --staged"],
    ["$0 fauna schema pull --delete"],
  ])
  .version(false)
  .help()
}

export default {
  builder: buildPullCommand,
  handler: doPull
}
