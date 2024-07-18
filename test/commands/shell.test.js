const mockRequire = require("mock-require");
const sinon = require("sinon");

const repl = {
  context: {},
  commands: {
    load: {},
    editor: {},
  },
  eval: (...args) => args[3](),
  defineCommand: function (cmd, cmdOptions) {
    this.commands[cmd] = cmdOptions;
  },
};

const { expect } = require("chai");
const {
  matchFqlReq,
  getEndpoint,
  fqlToJsonString,
} = require("../helpers/utils.js");
const { query: q, Expr } = require("faunadb");
const nock = require("nock");

// For some reason q.Now() is not mocked
describe.skip("shell", () => {
  let shell;
  let commandLogSpy;
  let consoleLog;
  // eslint-disable-next-line no-undef
  before(async () => {
    mockRequire("repl", {
      start: () => repl,
    });

    nock(getEndpoint())
      .persist()
      .post("/", matchFqlReq(q.Divide(10, 0)))
      .reply(400, {
        errors: [
          {
            position: [],
            code: "invalid argument",
            description: "Illegal division by zero.",
          },
        ],
      })
      .post("/")
      .reply(200, (_, req) => ({ resource: req }));

    const ShellCommand = mockRequire.reRequire("../../src/commands/shell");

    shell = new ShellCommand([]);
    shell.args = {};
    shell.flags = { secret: process.env.FAUNA_SECRET };
    commandLogSpy = sinon.spy(shell, "log");
    consoleLog = sinon.spy(console, "log");
    await shell.run();
  });

  // eslint-disable-next-line no-undef
  after(() => {
    nock.restore();
    mockRequire.stopAll();
  });

  // eslint-disable-next-line no-undef
  afterEach(() => {
    commandLogSpy.resetHistory();
    consoleLog.resetHistory();
  });

  it("initiated", () => {
    expect(commandLogSpy.lastCall.args[0]).to.equal(
      "Type Ctrl+D or .exit to exit the shell"
    );
    expect(Object.keys(shell.repl.commands)).to.eql(["clear", "last_error"]);
  });

  it("run fql", async () => {
    const fqls = [q.Paginate(q.Collections()), q.Now()];

    await fqls.map(
      (fql) =>
        new Promise((resolve, reject) => {
          shell.repl.eval(Expr.toString(fql), repl.context, "", (err) => {
            if (err) return reject(err);
            expect(consoleLog.lastCall.args[0]).to.string(fqlToJsonString(fql));
            resolve();
          });
        })
    );
  });

  it("run value FQL which is not valid JS", async () => {
    await new Promise((resolve, reject) => {
      shell.repl.eval(
        "{ name: 'Hen Wen', age: Add(100, 10) }",
        repl.context,
        "",
        (err) => {
          if (err) return reject(err);
          expect(consoleLog.lastCall.args[0]).to.string(
            '{"object":{"name":"Hen Wen","age":{"add":[100,10]}}}'
          );
          resolve();
        }
      );
    });
  });

  it("run fql that return an error", async () => {
    const fql = q.Divide(10, 0);

    await new Promise((resolve) => {
      shell.repl.eval(Expr.toString(fql), repl.context, "", () => {
        expect(commandLogSpy.lastCall.args[1]).to.string("invalid argument");
        resolve();
      });
    });
  });
});
