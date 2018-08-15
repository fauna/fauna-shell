const {Command, flags} = require('@oclif/command')
const {buildConnectionOptions, errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

/**
 * This is the base class for all fauna-shell commands.
 */
class FaunaCommand extends Command {

	/**
	 * During init we parse the flags and arguments and assign them
	 * to the `flags` and `args` member variables.
	 *
	 * We call `this.parse(this.constructor)` because we need to load
	 * flags and args for the command being run in the CLI.
	 * In this way we parse the flags and args defined in that command,
	 * plus the ones defined here. A command then needs to define its flags
	 * as follows, if it wants to inherit the flags defined in FaunaCommand:
	 *
	 * CreateKeyCommand.flags = {
	 *	...FaunaCommand.flags
	 * }
	 *
	 */
	async init() {
		const {flags: f, args: a} = this.parse(this.constructor)
		this.flags = f;
		this.args = a;
	}

	/**
	 * Runs the function in the context of a database connection.
	 *
	 * @param {function} f       - The function to run
	 * @param {string}   dbScope - The database in which the function will be executed.
	 * @param {string}   role    - The user role with which the function will be executed.
	 */
	withClient(f, dbScope, role) {
		const log = this.log
		const cmdFlags = this.flags;

		buildConnectionOptions(cmdFlags, dbScope, role)
		.then(function(connectionOptions) {
			var client = new faunadb.Client(connectionOptions);
			//TODO this should return a Promise
			f(client, connectionOptions);
		})
		.catch(function(err) {
			errorOut(err, 1)
		});
	}

	/**
	 * Runs the provided query, while logging a message before running it.
	 * Calls the success callback on success, or the failure one otherwise.
	 *
	 * @param {query}    queryExpr - The Query to execute.
	 * @param {string}   logMsg    - The message to display before executing the query.
	 * @param {function} success   - On success callback.
	 * @param {function} failure   - On error callback.
	 */
	query(queryExpr, logMsg, success, failure) {
		const log = this.log;
		this.withClient(function(client, endpoint) {
		  log(logMsg);
		  client.query(queryExpr)
		  .then(success)
		  .catch(failure);
		});
	}

	/**
	 * @todo this should accept an extractor function that
	 * knows how to access data from each page element.
	 * Right now it only access the `id` field of the element.
	 *
	 * Runs the provided query and handles the pagination.
	 * Displays a message before running the query, and an
	 * empty message in case the query produces no results.
	 *
	 * @param {query} queryExpr     - The Query to execute.
	 * @param {string} logMsg       - The message to display before executing the query.
	 * @param {string} emptyMessage - The message to display if empty results.
	 */
	paginate(queryExpr, logMsg, emptyMessage) {
		const log = this.log;
		this.withClient(function(client, endpoint) {
			log(logMsg);
			var results = [];
			var helper = client.paginate(queryExpr);
			helper.each(function(page) {
				results.push(page)
			}).then(function(done) {
				if (results.length > 0) {
					var tmp = [].concat.apply([], results)
					tmp.sort()
					tmp.forEach(function(item) {
						log(item.id);
					})
				} else {
					log(emptyMessage)
				}
			});
		});
	}
}


/**
 * These flags allow the user to override endpoint configuration.
 * They are inherited by all shell commands that extend FaunaCommand.
 * See each command's flags to see how this mechanism works.
 */
FaunaCommand.flags = {
	...Command.flags,
	domain: flags.string({
    description: 'FaunaDB server domain',
  }),
	scheme: flags.string({
    description: 'Connection scheme',
		options: ['https', 'http'],
  }),
	port: flags.string({
    description: 'Connection port',
  }),
	timeout: flags.string({
    description: 'Connection timeout in milliseconds',
  }),
	secret: flags.string({
		description: 'FaunaDB secret key',
  }),
	endpoint: flags.string({
		description: 'FaunaDB server endpoint',
  }),
}

module.exports = FaunaCommand;