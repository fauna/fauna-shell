const {cli} = require('cli-ux')
const {handleConfigOrError, fileNotFound, readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const os = require("os");
const request = require('request');

class CloudLoginCommand extends FaunaCommand {
	async run() {
		const SHELL_LOGIN_URL = 'https://app.fauna.com/shell_login';

		const email = await cli.prompt('Email', {timeout: 120000})	
		const password = await cli.prompt('Password', {type: 'hide', timeout: 120000})

		const endpoint = 'https://db.fauna.com';
		const alias = 'cloud';
		
		const formData = {
			email: email,
			password: password,
			session: "Fauna Shell - " + os.hostname()
		}
		
		request.post({url: SHELL_LOGIN_URL, form: formData}, function(error, response, body) {
			if (!error) {
				if (response.statusCode == 200) {
					const secret = JSON.parse(body).secret;
					readFile(getConfigFile())
					.then(function(configData) {
						handleConfigOrError(configData, endpoint, secret, alias);
					})
					.catch(function(err) {
						if (fileNotFound(err)) {
							// the .fauna-shell file doesn't exist, so there's no initial configData.
							handleConfigOrError("", endpoint, secret, alias);
						} else {
							errorOut(err, 1)
						}
					});
				} else {
					// there was an error in the HTTP request
					errorOut(JSON.parse(body).message, 1);
				}
			} else {
				// there was an error performing the HTTP request
				errorOut(error, 1);
			}
		});
	}
}

CloudLoginCommand.description = `
Adds a cloud endpoint for FaunaDB
`

CloudLoginCommand.examples = [
	'$ fauna cloud-login'
]

FaunaCommand.flags = {
}

CloudLoginCommand.args = [
]

module.exports = CloudLoginCommand