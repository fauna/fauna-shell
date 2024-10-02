import { container } from '../../cli.mjs'
import { confirm } from "@inquirer/prompts";
import { commonQueryOptions } from '../../lib/command-helpers.mjs';

async function doPush(argv) {
  const logger = (await container.resolve("logger"))
  const fetch = container.resolve("fetch")

  const gatherFSL = container.resolve("gatherFSL")
  try {
    const fsl = await gatherFSL(argv.dir)
    if (argv.force) {
      const params = new URLSearchParams()
      if (argv.force)
        params.set("force", "true")
      if (argv.staged)
        params.set("staged", "true")

      const path = new URL(`/schema/1/update?${params}`, argv.url);
      const res = await fetch(path.toString(), {
        method: "POST",
        headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
        body: fsl,
        // https://github.com/nodejs/node/issues/46221
        // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
        duplex: "half",
      });

      const json = await res.json();
      if (json.error) {
        logger.stderr(json.error?.message ?? json.error);
      }
    } else {
      // Confirm diff, then push it. `force` is set on `validate` so we don't
      // need to pass the last known schema version through.
        const params = new URLSearchParams({ force: true })
      if (argv.color)
        params.set("color", "ansi")
      const path = new URL(`/schema/1/validate?${params}`, argv.url);
      const res = await fetch(path, {
        method: "POST",
        headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
        body: fsl,
        duplex: "half",
      });

      const json = await res.json();
      if (json.error) {
        logger.stderr(json.error?.message ?? json.error);
      }

      let message = "Accept and push changes?";
      if (json.diff) {
        logger.stdout(`Proposed diff:\n`);
        logger.stdout(json.diff);
      } else {
        logger.stdout("No logical changes.");
        message = "Push file contents anyway?";
      }
      const confirmed = await confirm({
        message,
        default: false,
      });

      if (confirmed) {
        const params = new URLSearchParams({
          version: json.version,
          staged: argv.staged ? "true" : "false",
        });

        const path = new URL(`/schema/1/update?${params}`, argv.url);
        const res = await fetch(path, {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
          body: fsl,
          duplex: "half",
        });

        const json0 = await res.json();
        if (json0.error) {
          logger.stderr(json0.error.message);
        }
      } else {
        logger.stdout("Push cancelled");
      }
    }
  } catch (err) {
    logger.stderr(err);
  }
}

function buildPushCommand(yargs) {
  return yargs
  .options({
    ...commonQueryOptions,
    force: {
      description: "Push the change without a diff or schema version check",
      type: 'boolean',
      default: false
    },
    staged: {
      description: "Stages the schema change instead of applying it immediately",
      type: 'boolean',
      default: false
    }
  })
  .example([
    ["$0 fauna schema push"],
    ["$0 fauna schema push --dir schemas/myschema"],
    ["$0 fauna schema push --staged"],
  ])
  .version(false)
  .help()
}

export default {
  builder: buildPushCommand,
  handler: doPush
}
