//@ts-check

import createCommand from "./create.mjs";
import deleteCommand from "./delete.mjs";
import listCommand from "./list.mjs";

function buildDatabase(yargs) {
  return yargs
    .options({
      profile: {
        type: "string",
        description: "a user profile",
        default: "default",
      },
    })
    .command(listCommand)
    .command(createCommand)
    .command(deleteCommand)
    .demandCommand()
    .version(false)
    .help("help", "show help");
}

export default {
  command: "database",
  aliases: ["db"],
  describe: "Interact with your databases",
  builder: buildDatabase,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};
