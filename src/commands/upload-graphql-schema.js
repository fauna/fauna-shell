const FaunaCommand = require("../lib/fauna-command.js").default;
import { Flags, Args } from "@oclif/core";
const fs = require("fs");
const path = require("path");

class UploadGraphQLSchemaCommand extends FaunaCommand {
  allowedExt = [".graphql", ".gql"];

  static description = "Upload GraphQL schema.";

  static examples = [
    "$ fauna upload-graphql-schema ./schema.gql",
    "$ fauna upload-graphql-schema ./schema.gql --mode override",
  ];

  static args = {
    graphqlFilePath: Args.string({
      required: true,
      description: "Path to GraphQL schema",
    }),
  };

  static flags = {
    ...FaunaCommand.flags,
    graphqlHost: Flags.string({
      description: "The Fauna GraphQL API host",
    }),
    graphqlPort: Flags.string({
      description: "GraphQL port",
    }),
    mode: Flags.string({
      description: "Upload mode",
      default: "merge",
      options: ["merge", "override", "replace"],
    }),
  };

  async run() {
    try {
      const { graphqlFilePath } = this.args;
      const { mode } = this.flags;

      if (!this.allowedExt.includes(path.extname(graphqlFilePath))) {
        this.error(
          "Your GraphQL schema file must include the `.graphql` or `.gql` extension."
        );
      }

      const {
        connectionOptions: { secret, graphqlHost, graphqlPort, scheme },
      } = await this.getClient();

      console.info(`UPLOADING SCHEMA (mode=${mode}): ${graphqlFilePath}`);
      const text = await fetch(
        `${scheme}://${graphqlHost}:${graphqlPort}/import?mode=${mode}`,
        {
          method: "POST",
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: fs.readFileSync(graphqlFilePath),
        }
      ).then((response) => response.text());

      console.info("RESPONSE:");
      console.info(text);
    } catch (error) {
      this.error(error);
    }
  }
}

module.exports = UploadGraphQLSchemaCommand;
