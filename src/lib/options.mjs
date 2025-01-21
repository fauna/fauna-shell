//@ts-check

import { Format } from "./formatting/colorize.mjs";

/**
 * Options required for any command making API requests to the Account API
 */
export const ACCOUNT_OPTIONS = {
  "account-url": {
    type: "string",
    description: "The Fauna account URL to query",
    default: "https://account.fauna.com",
    hidden: true,
  },
  "account-key": {
    type: "string",
    description:
      "Fauna account key used for authentication. Can't be used with --user or --secret.",
    required: false,
    group: "API:",
  },
  user: {
    alias: "u",
    type: "string",
    description:
      "CLI user to run the command as. You must first log in as the user using 'fauna login'.",
    default: "default",
    group: "API:",
  },
  role: {
    alias: "r",
    type: "string",
    description: "Role used to run the command.",
    group: "API:",
  },
};

/**
 * Options required for commands relying on a database path
 */
export const DATABASE_PATH_OPTIONS = {
  database: {
    alias: "d",
    type: "string",
    description:
      "Database, including Region Group and hierarchy, to run the command in. Ex: 'us/my_db', 'eu/parent_db/child_db', 'global/db'.",
    group: "API:",
  },
};

/**
 * Options required for commands making API requests to the Core API
 */
export const CORE_OPTIONS = {
  local: {
    type: "boolean",
    describe:
      "Use a local Fauna container. Sets --url to 'http://0.0.0.0:8443' and --secret to 'secret'.",
    default: false,
    group: "API:",
  },
  url: {
    type: "string",
    description:
      "URL for Core HTTP API requests made by the command. Defaults to https://db.fauna.com.",
    group: "API:",
  },
  secret: {
    type: "string",
    description: "Secret used for authentication.",
    required: false,
    group: "API:",
  },
};

export const QUERY_INFO_CHOICES = [
  "txnTs",
  "schemaVersion",
  "summary",
  "queryTags",
  "stats",
];

/**
 * Options required for commands making FQL queries to the Core API
 */
export const QUERY_OPTIONS = {
  "api-version": {
    description: "FQL version to use.",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
    group: "API:",
  },
  // v10 specific options
  format: {
    type: "string",
    alias: "f",
    description:
      "Output format for the query. When present, --json takes precedence over --format. Only applies to v10 queries.",
    choices: [Format.FQL, Format.JSON],
    default: Format.FQL,
    group: "API:",
  },
  typecheck: {
    type: "boolean",
    description:
      "Enable typechecking. Defaults to the typechecking setting of the database.",
    default: undefined,
    group: "API:",
  },
  timeout: {
    type: "number",
    description:
      "Maximum query runtime in milliseconds. Only applies to v10 queries.",
    default: 5000,
    group: "API:",
  },
  "performance-hints": {
    type: "boolean",
    description:
      "Output performance hints. Sets --include summary. Only applies to v10 queries. If no performance hints are returned, no hints are output.",
    default: false,
    group: "API:",
  },
  "max-attempts": {
    type: "number",
    description:
      "Maximum number of retry attempts when queries fail with throttling errors. Only applies to v10 queries.",
    default: undefined,
    group: "API:",
  },
  "max-backoff": {
    type: "number",
    description:
      "Maximum backoff time (in milliseconds) between retry attempts. Only applies to v10 queries.",
    default: undefined,
    group: "API:",
  },
  "max-contention-retries": {
    type: "number",
    description:
      "Maximum number of retry attempts when queries fail with contention errors.",
    default: undefined,
    group: "API:",
  },
  include: {
    type: "array",
    choices: ["all", "none", ...QUERY_INFO_CHOICES],
    default: ["summary"],
    description:
      "Query response info to output. Pass values as a space-separated list. Ex: --include summary queryTags.",
  },
};
