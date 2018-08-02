const {cli} = require('cli-ux')
const {validCloudEndpoint, saveEndpointOrError, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const os = require("os");
const request = require('request');
const url = require('url');

class CloudLoginCommand extends FaunaCommand {
	async run() {
		validCloudEndpoint()
		.then(async function(_valid) {			
			const SHELL_LOGIN_URL = 'https://app.fauna.com/shell_login';
			const CLOUD_URL = 'https://db.fauna.com';
			const email = await cli.prompt('Email', {timeout: 120000})	
			const password = await cli.prompt('Password', {type: 'hide', timeout: 120000})
			const newEndpoint = url.parse(CLOUD_URL);
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
						saveEndpointOrError(newEndpoint, alias, secret);
					} else {
						// there was an error in the HTTP request
						errorOut(JSON.parse(body).message, 1);
					}
				} else {
					// there was an error performing the HTTP request
					errorOut(error, 1);
				}
			});
		})
		.catch(function(err) {
			errorOut(err, 1)
		});
	}
}

CloudLoginCommand.description = `
Adds the FaunaDB Cloud endpoint
`

CloudLoginCommand.examples = [
	'$ fauna cloud-login'
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
CloudLoginCommand.flags = {
}

CloudLoginCommand.args = [
]

module.exports = CloudLoginCommand