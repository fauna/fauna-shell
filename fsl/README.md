# Shell FSL Tests

This directory contains an fsl setup used to run some schema command tests from within a project.
In the below steps, using the default endpoint path will test out the local dev experience utilizing the environemnt configuration.
Using the provided secret path will test out how schema updates will work in a pipeline, with a direct secret provided.

To run them against your local changes you need to do the following:
1. Obtain the secret the pipeline uses.
2. Run `fauna endpoint add cli_test-us --secret $SECRET --no-input`.
3. Build your version of the shell with `yarn build` in the root repo directory
4. Run the test script: `./test-script.mjs ~/fauna/fauna-shell/bin/run`

To run ad-hoc commands against the test database, you will need to provide the `--secret` flag (since a db key does not work with the `./fauna-project` file in this directory). For example: `fauna schema status --endpoint cli_test-us --secret $SECRET`.
