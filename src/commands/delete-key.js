const FaunaCommand = require("../lib/fauna-command.js");
const { Args } = require("@oclif/core");
const faunadb = require("faunadb");
const q = faunadb.query;

class DeleteKeyCommand extends FaunaCommand {
  async run() {
    const keyname = this.args.keyname;
    return this.query(
      q.Delete(q.Ref(q.Keys(null), keyname)),
      `deleting key ${keyname}`,
      (success) => {
        this.log(`key ${success.ref.id} deleted`);
      },
      (error) => {
        if (error.message === "instance not found") {
          this.error(`Key ${keyname} not found`, 1);
        } else {
          this.error(error.message, 1);
        }
      }
    );
  }
}

DeleteKeyCommand.description = `
Deletes a key
`;

DeleteKeyCommand.examples = ["$ fauna delete-key 123456789012345678"];

DeleteKeyCommand.flags = {
  ...FaunaCommand.flags,
};

DeleteKeyCommand.args = {
  keyname: Args.string({
    required: true,
    description: "key name",
  }),
};

module.exports = DeleteKeyCommand;
