/*eslint no-unused-expressions: [2, { allowTernary: true }]*/
const vm = require("vm");
const os = require("os");
const path = require("path");
const fs = require("fs");
const ini = require("ini");
const { cli } = require("cli-ux");
const faunadb = require("faunadb");
const escodegen = require("escodegen");
const fetch = require("node-fetch");

const FAUNA_CLOUD_DOMAIN = "db.fauna.com";
const ERROR_NO_DEFAULT_ENDPOINT =
  "You need to set a default endpoint. \nTry running 'fauna default-endpoint ENDPOINT_ALIAS'.";
const ERROR_WRONG_CLOUD_ENDPOINT =
  "You already have an endpoint 'cloud' defined and it doesn't point to 'db.fauna.com'.\nPlease fix your '~/.fauna-shell' file.";
const ERROR_SPECIFY_SECRET_KEY =
  "You must specify a secret key to connect to Fauna";

/**
 * Takes a parsed endpointURL, an endpoint alias, and the endpoint secret,
 * and saves it to the .ini config file.
 *
 * - If the endpoint already exists, it will be overwritten, after asking confirmation
 *   from the user.
 * - If no other endpoint exists, then the endpoint will be set as the default one.
 */
function saveEndpointOrError(newEndpoint, alias, secret) {
  return loadEndpoints().then(function (endpoints) {
    if (endpointExists(endpoints, alias)) {
      return confirmEndpointOverwrite(alias).then(function (overwrite) {
        if (overwrite) {
          return saveEndpoint(endpoints, newEndpoint, alias, secret);
        } else {
          throw new Error("Try entering a different endpoint alias.");
        }
      });
    } else {
      return saveEndpoint(endpoints, newEndpoint, alias, secret);
    }
  });
}

function deleteEndpointOrError(alias) {
  return loadEndpoints().then(function (endpoints) {
    if (endpointExists(endpoints, alias)) {
      return confirmEndpointDelete(alias).then(function (del) {
        if (del) {
          return deleteEndpoint(endpoints, alias);
        } else {
          throw new Error("Couldn't override endpoint");
        }
      });
    } else {
      throw new Error(`The endpoint '${alias}' doesn't exist`);
    }
  });
}

/**
 * Validates that the 'cloud' endpoint points to FAUNA_CLOUD_DOMAIN.
 */
// TODO: candidate to delete if new-cloud-login accepted
function validCloudEndpoint() {
  return loadEndpoints().then(function (config) {
    return new Promise(function (resolve, reject) {
      if (config.cloud && config.cloud.domain !== FAUNA_CLOUD_DOMAIN) {
        reject(new Error(ERROR_WRONG_CLOUD_ENDPOINT));
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Sets `endpoint` as the default endpoint.
 * If `endpoint` doesn't exist, returns an error.
 */
function setDefaultEndpoint(endpoint) {
  return loadEndpoints().then(function (endpoints) {
    return new Promise(function (resolve, reject) {
      if (endpoints[endpoint]) {
        endpoints.default = endpoint;
        return saveConfig(endpoints)
          .then(function (_) {
            resolve(`Endpoint '${endpoint}' set as default endpoint.`);
          })
          .catch(function (err) {
            reject(err);
          });
      } else {
        reject(new Error(`Endpoint '${endpoint}' doesn't exist.`));
      }
    });
  });
}

/**
 * Loads the endpoints from the ~/.fauna-shell file.
 * If the file doesn't exist, returns an empty object.
 */
function loadEndpoints() {
  return readFile(getConfigFile())
    .then(function (configData) {
      return ini.parse(configData);
    })
    .catch(function (err) {
      if (fileNotFound(err)) {
        return {};
      }
      throw err;
    });
}

function endpointExists(endpoints, endpointAlias) {
  return endpointAlias in endpoints;
}

function confirmEndpointOverwrite(alias) {
  return cli.confirm(
    `The '${alias}' endpoint already exists. Overwrite? [y/n]`
  );
}

function confirmEndpointDelete(alias) {
  return cli.confirm(
    `Are you sure you want to delete the '${alias}' endpoint? [y/n]`
  );
}

function saveEndpoint(config, endpoint, alias, secret) {
  var port = endpoint.port ? `:${endpoint.port}` : "";
  var uri = `${endpoint.protocol}//${endpoint.hostname}${port}`;

  return fetch(uri, { method: "HEAD" }).then(function (res) {
    if (res.headers.get("x-faunadb-build")) {
      return saveConfig(addEndpoint(config, endpoint, alias, secret));
    }
    throw new Error(`'${alias}' is not a Fauna endopoint`);
  });
}

function addEndpoint(config, endpoint, alias, secret) {
  if (shouldSetAsDefaultEndpoint(config)) {
    config.default = alias;
  }
  config[alias] = buildEndpointObject(endpoint, secret);
  return config;
}

function deleteEndpoint(endpoints, alias) {
  if (endpoints.default === alias) {
    delete endpoints.default;
    console.log(
      `Endpoint '${alias}' deleted. '${alias}' was the default endpoint.`
    );
    console.log(ERROR_NO_DEFAULT_ENDPOINT);
  }
  delete endpoints[alias];
  return saveConfig(endpoints);
}

function shouldSetAsDefaultEndpoint(config) {
  return "default" in config === false;
}

function buildEndpointObject(endpoint, secret) {
  return {
    ...(endpoint.hostname && { domain: endpoint.hostname }),
    ...(endpoint.port && { port: endpoint.port }),
    ...(endpoint.protocol && { scheme: endpoint.protocol.slice(0, -1) }),
    ...(secret && { secret }),
    ...(endpoint.graphql &&
      endpoint.graphql.hostname && {
        graphqlHost: endpoint.graphql.hostname,
      }),
    ...(endpoint.graphql &&
      endpoint.graphql.port && { graphqlPort: endpoint.graphql.port }),
  };
}

/**
 * Converts the `config` data provided to INI format, and then saves it to the
 * ~/.fauna-shell file.
 */
function saveConfig(config) {
  return writeFile(getConfigFile(), ini.stringify(config), 0o700);
}

/**
 * Returns the full path to the `.fauna-shell` config file
 */
function getConfigFile() {
  return path.join(os.homedir(), ".fauna-shell");
}

/**
 * Wraps `fs.readFile` into a Promise.
 */
function readFile(fileName) {
  return new Promise(function (resolve, reject) {
    fs.readFile(fileName, "utf8", (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}

/**
 * Wraps `fs.writeFile` into a Promise.
 */
function writeFile(fileName, data, mode) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(fileName, data, { mode: mode }, (err) => {
      err ? reject(err) : resolve(data);
    });
  });
}

/**
 * Tests if an error is of the type "file not found".
 */
function fileNotFound(err) {
  return err.code === "ENOENT" && err.syscall === "open";
}

/**
 * Builds the options provided to the faunajs client.
 * Tries to load the ~/.fauna-shell file and read the default endpoint from there.
 *
 * Assumes that if the file exists, it would have been created by fauna-shell,
 * therefore it would have a defined endpoint.
 *
 * Flags like --host, --port, etc., provided by the CLI take precedence over what's
 * stored in ~/.fauna-shell.
 *
 * The --endpoint flag overries the default endpoint from fauna-shell.
 *
 * If ~/.fauna-shell doesn't exist, tries to build the connection options from the
 * flags passed to the script.
 *
 * It always expect a secret key to be set in ~/.fauna-shell or provided via CLI
 * arguments.
 *
 * @param {Object} cmdFlags - flags passed via the CLI.
 * @param {string} dbScope  - A database name to scope the connection to.
 * @param {string} role     - A user role: 'admin'|'server'|'server-readonly'|'client'.
 */
function buildConnectionOptions(cmdFlags, dbScope, role) {
  return new Promise(function (resolve, reject) {
    readFile(getConfigFile())
      .then(function (configData) {
        var endpoint = {};
        const config = ini.parse(configData);
        // having a valid endpoint, assume there's a secret set
        if (hasValidEndpoint(config, cmdFlags.endpoint)) {
          endpoint = getEndpoint(config, cmdFlags.endpoint);
        } else if (!cmdFlags.hasOwnProperty("secret")) {
          reject(ERROR_NO_DEFAULT_ENDPOINT);
        }
        //TODO add a function endpointFromCmdFlags that builds an endpoint and clean up the code.
        const defaults = { graphqlHost: "graphql.fauna.com", graphqlPort: 443 };
        const connectionOptions = Object.assign(defaults, endpoint, cmdFlags);
        //TODO refactor duplicated code
        if (connectionOptions.secret) {
          resolve(
            cleanUpConnectionOptions(
              maybeScopeKey(connectionOptions, dbScope, role)
            )
          );
        } else {
          reject(ERROR_SPECIFY_SECRET_KEY);
        }
      })
      .catch(function (err) {
        if (fileNotFound(err)) {
          if (cmdFlags.secret) {
            resolve(
              cleanUpConnectionOptions(maybeScopeKey(cmdFlags, dbScope, role))
            );
          } else {
            reject(ERROR_SPECIFY_SECRET_KEY);
          }
        } else {
          reject(err);
        }
      });
  });
}

function getEndpoint(config, cmdEndpoint) {
  const alias = cmdEndpoint ? cmdEndpoint : config.default;
  return config[alias];
}

function hasValidEndpoint(config, cmdEndpoint) {
  if (cmdEndpoint) {
    return config.hasOwnProperty(cmdEndpoint);
  } else {
    return (
      config.hasOwnProperty("default") && config.hasOwnProperty(config.default)
    );
  }
}

/**
 * Makes sure the connectionOptions options passed to the js client
 * only contain valid properties.
 */
function cleanUpConnectionOptions(connectionOptions) {
  const accepted = [
    "domain",
    "scheme",
    "port",
    "secret",
    "timeout",
    "graphqlHost",
    "graphqlPort",
  ];
  const res = {};
  accepted.forEach(function (key) {
    if (connectionOptions[key]) {
      res[key] = connectionOptions[key];
    }
  });
  res.fetch = fetch; // force http1
  return res;
}

/**
 * If `dbScope` and `role` aren't null, then the secret key is scoped to
 * the `dbScope` database for the provided user `role`.
 */
function maybeScopeKey(config, dbScope, role) {
  var scopedSecret = config.secret;
  if (dbScope !== undefined && role !== undefined) {
    scopedSecret = config.secret + ":" + dbScope + ":" + role;
  }
  return Object.assign(config, { secret: scopedSecret });
}

// adapted from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
function promiseSerial(fs) {
  return fs.reduce(function (promise, f) {
    return promise.then(function (result) {
      return f().then(Array.prototype.concat.bind(result));
    });
  }, Promise.resolve([]));
}

class QueryError extends Error {
  constructor(exp, faunaError, queryNumber, ...params) {
    super(params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueryError);
    }

    this.exp = exp;
    this.faunaError = faunaError;
    this.queryNumber = queryNumber;
  }
}

function wrapQueries(expressions, client) {
  const q = faunadb.query;
  vm.createContext(q);
  return expressions.map(function (exp, queryNumber) {
    return function () {
      return client
        .query(vm.runInContext(escodegen.generate(exp), q))
        .catch(function (err) {
          throw new QueryError(escodegen.generate(exp), err, queryNumber + 1);
        });
    };
  });
}

function runQueries(expressions, client) {
  if (expressions.length === 1) {
    var f = wrapQueries(expressions, client)[0];
    return f();
  } else {
    return promiseSerial(wrapQueries(expressions, client));
  }
}

function stringifyEndpoint(endpoint) {
  var res = "";
  if (endpoint.scheme) {
    res += endpoint.scheme + "://";
  }
  res += endpoint.domain;
  if (endpoint.port) {
    res += ":" + endpoint.port;
  }
  return res;
}

module.exports = {
  saveEndpointOrError: saveEndpointOrError,
  saveEndpoint: saveEndpoint,
  deleteEndpointOrError: deleteEndpointOrError,
  setDefaultEndpoint: setDefaultEndpoint,
  validCloudEndpoint: validCloudEndpoint,
  loadEndpoints: loadEndpoints,
  buildConnectionOptions: buildConnectionOptions,
  readFile: readFile,
  writeFile: writeFile,
  runQueries: runQueries,
  stringifyEndpoint: stringifyEndpoint,
  getConfigFile: getConfigFile,
};
