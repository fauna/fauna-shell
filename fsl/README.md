# Shell FSL Tests

This directory contains an fsl setup used to run some schema command tests from within a project.
In the below steps, using the default endpoint path will test out the local dev experience utilizing the environemnt configuration.
Using the provided secret path will test out how schema updates will work in a pipeline, with a direct secret provided.

To run them against your local changes you need to do the following:
1. create a database called FaunaCLITest
2. Do one of the following:
    1. Setup a default endpoint called cli_test-us via fauna cloud-login
    2. Obtain a secret for the FaunaCLITest database
3. build your version of the shell with `yarn build` in the root repo directory
4. Run the test script with one of the following:
    1. If you have the default endpoint setup, 
        1. `./test-script.mjs ~/fauna/fauna-shell/bin/run`
    2. If using the database secret, 
        1. `FAUNA_SECRET=[INSERT SECRET] ./test-script.mjs ~/fauna/fauna-shell/bin/run`


