### General style guidelines
- Prefer to throw errors instead of exiting the process. Exit is harder to mock well in tests, and the global error-handler in `src/cli.mjs` should already do verbosity-aware error-handling. You can request a specific exit code by attaching an `exitCode` property to your error before throwing it. The error-handling has a series of tests in `yargs-test/general-cli.mjs`; if you find a case where throwing results in bad output to the user, replicate that case in a test suite.
- Prefer to re-throw an existing error after modifying its message over catching and throwing a newly-constructed error. The `exitCode` and `stack` properties on the existing error are worth keeping.

#### Testing guidelines
- Prefer to mock the "far" edges of the application - methods on `fs`, complex async libraries (e.g., `http#Server`), `fetch`. This results in the test code traversing all of the CLI's business logic, but not interacting with error-prone external resources like disk, network, port availability, etc. `sinon` records all calls to a mock, and allows asserting against them. Use this if, e.g., your business logic calls `fetch` multiple times.
- Prefer to run local tests in watch mode with (e.g., with `yarn local-test`) while developing.

