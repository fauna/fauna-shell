### Quick Start

```
npm install
npm run build
./src/user-entrypoint.mjs
```



### Application versions

This project has 3 runnable entrypoints (a raw ESM one, a built CJS one, and an SEA one). You can read more about them [here](./sea/README.md).

### General style guidelines

- Prefer to throw errors instead of exiting the process. Exit is harder to mock well in tests, and the global error-handler in `src/cli.mjs` should already do verbosity-aware error-handling. You can request a specific exit code by attaching an `exitCode` property to your error before throwing it. The error-handling has a series of tests in `yargs-test/general-cli.mjs`; if you find a case where throwing results in bad output to the user, replicate that case in a test suite.
- Prefer to re-throw an existing error after modifying its message over catching and throwing a newly-constructed error. The `exitCode` and `stack` properties on the existing error are worth keeping.

#### Testing guidelines

- Prefer to mock the "far" edges of the application - methods on `fs`, complex async libraries (e.g., `http#Server`), `fetch`. This results in the test code traversing all of the CLI's business logic, but not interacting with error-prone external resources like disk, network, port availability, etc. `sinon` records all calls to a mock, and allows asserting against them. Use this if, e.g., your business logic calls `fetch` multiple times.
- ~~Prefer to run local tests in watch mode with (e.g., with `yarn local-test`) while developing.~~ This is currently broken.
- Use debug logs to output the shape of objects (especially network responses) to determine how to structure mocks. For instance, to get a quick mock for a network request caused by `fauna schema status ...`, set the situation up and run `fauna schema status ... --verbosity 5`. You can then use the logged objects as mocks.

#### Debugging strategies

- Fetch is not particularly amenable to debugging, but if you need to see the raw requests being made, open a netcat server locally (`nc -l 8080`) and then change the code to call the netcat server, either by passing the flag `--url http://localhost:8080` or by editing the code.
- This project has debug logging with a somewhat configurable logging strategy. To use it, provide either:
  - `--verbose-component foo`, which logs all debug info for the component `foo`. Because it's an array, you can specify it multiple times. To see the available components, look at the help or tab completion.
  - `--verbosity level`, where `level` is a number from 0 (no debug logging) to 5 (all debug logging) for all components.
- To investigate why a sinon stub is failing in a way you don't expect, you can log out `stub.args`, which is an array of the arguments provided each time the stub was called. This can be particularly helpful for assertions where the error message is hard to read or involves objects that don't stringify correctly (like FormData).
- To trigger [SEA builds](./sea/README.md) on all supported OS/architecture combinations, make changes and push commits to the `build` branch in github. This will [trigger github actions](./.github/workflows/build-binaries.yml) that build the SEA binaries.
