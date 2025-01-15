import * as awilix from "awilix";
import { expect } from "chai";
import sinon from "sinon";

import { setContainer } from "../../../src/config/container.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import accountAPI from "../../../src/lib/account-api.mjs";
import { f } from "../../helpers.mjs";

describe("accountAPI", () => {
  let container, fetch;

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");

    container.register({
      credentials: awilix.asValue({
        accountKeys: {
          key: "some-account-key",
          onInvalidCreds: async () => {
            container.resolve("credentials").accountKeys.key =
              "new-account-key";
            return Promise.resolve();
          },
          promptLogin: sinon.stub(),
        },
      }),
    });

    setContainer(container);
  });

  describe("listDatabases", () => {
    const testResults = {
      results: [{ name: "test-db", path: "us-std/test-db" }],
    };
    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases?max_results=1000",
          }),
          sinon.match.any,
        )
        .resolves(f(testResults, 200));

      const data = await accountAPI.listDatabases();

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/api/v1/databases?max_results=1000",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );
      expect(data).to.deep.equal(testResults);
    });

    it("should call the endpoint with a path", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases?max_results=1000&path=us-std%2Ftest-db",
          }),
        )
        .resolves(
          f({
            results: [{ name: "test-db", path: "us-std/test-db" }],
          }),
        );

      await accountAPI.listDatabases({ path: "us-std/test-db" });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/api/v1/databases?max_results=1000&path=us-std%2Ftest-db",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );
    });
  });

  describe("createKey", () => {
    const testKey = {
      id: "key-id",
      role: "admin",
      path: "us-std/test-db",
      ttl: "2025-01-01T00:00:00.000Z",
      name: "test-key",
    };

    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/api/v1/databases/keys",
          }),
          sinon.match.any,
        )
        .resolves(f(testKey, 201));

      const { role, path, ttl, name } = testKey;
      const data = await accountAPI.createKey({ role, path, ttl, name });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/api/v1/databases/keys",
        }),
        sinon.match({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer some-account-key",
          },
          body: JSON.stringify({ role, path, ttl, name }),
        }),
      );

      expect(data).to.deep.equal(testKey);
    });
  });

  describe("createExport", () => {
    const testExport = {
      id: "419633606504219216",
      state: "Pending",
      database: "us-std/demo",
      format: "simple",
      destination: {
        s3: {
          bucket: "test-bucket",
          path: "some/key",
        },
      },
      created_at: "2025-01-09T19:57:22.735201Z",
    };

    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({ href: "https://account.fauna.com/v2/exports" }),
          sinon.match({ method: "POST" }),
        )
        .resolves(f({ response: testExport }, 201));

      const data = await accountAPI.createExport({
        database: "us/demo",
        format: "simple",
        destination: {
          s3: {
            bucket: "test-bucket",
            path: "some/key",
          },
        },
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({ href: "https://account.fauna.com/v2/exports" }),
        sinon.match({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer some-account-key",
          },
          body: JSON.stringify({
            database: "us-std/demo",
            destination: {
              s3: { bucket: "test-bucket", path: "some/key" },
            },
            format: "simple",
          }),
        }),
      );
      expect(data).to.deep.equal({
        ...testExport,
        destination_uri: "",
      });
    });

    it("should support collections", async () => {
      fetch
        .withArgs(
          sinon.match({ href: "https://account.fauna.com/v2/exports" }),
          sinon.match({ method: "POST" }),
        )
        .resolves(
          f(
            { response: { ...testExport, collections: ["test-collection"] } },
            201,
          ),
        );

      const data = await accountAPI.createExport({
        database: "us/demo",
        format: "simple",
        destination: {
          s3: {
            bucket: "test-bucket",
            path: "some/key",
          },
        },
        collections: ["test-collection"],
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({ href: "https://account.fauna.com/v2/exports" }),
        sinon.match({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer some-account-key",
          },
          body: JSON.stringify({
            database: "us-std/demo",
            destination: {
              s3: { bucket: "test-bucket", path: "some/key" },
            },
            format: "simple",
            collections: ["test-collection"],
          }),
        }),
      );
      expect(data).to.deep.equal({
        ...testExport,
        collections: ["test-collection"],
        destination_uri: "",
      });
    });

    it("should support tagged format", async () => {
      fetch
        .withArgs(
          sinon.match({ href: "https://account.fauna.com/v2/exports" }),
          sinon.match({ method: "POST" }),
        )
        .resolves(f({ response: { ...testExport, format: "tagged" } }, 201));

      const data = await accountAPI.createExport({
        database: "us/demo",
        format: "tagged",
        destination: {
          s3: {
            bucket: "test-bucket",
            path: "some/key",
          },
        },
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({ href: "https://account.fauna.com/v2/exports" }),
        sinon.match({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer some-account-key",
          },
          body: JSON.stringify({
            database: "us-std/demo",
            destination: {
              s3: { bucket: "test-bucket", path: "some/key" },
            },
            format: "tagged",
          }),
        }),
      );
      expect(data).to.deep.equal({
        ...testExport,
        format: "tagged",
        destination_uri: "",
      });
    });
  });

  describe("listExports", () => {
    const testExport = {
      id: "419630463817089613",
      state: "Failed",
      database: "us-std/demo",
      created_at: "2025-01-09T19:07:25.642703Z",
      updated_at: "2025-01-09T19:07:25.642703Z",
      destination: {
        s3: {
          bucket: "test-bucket",
          path: "some/key",
        },
      },
    };

    beforeEach(() => {
      fetch
        .withArgs(
          sinon.match({
            href: sinon.match(/exports/),
          }),
        )
        .resolves(
          f(
            {
              response: {
                results: [testExport, { ...testExport, state: "Complete" }],
                next_token: "456",
              },
            },
            200,
          ),
        );
    });

    it("should call the endpoint and return its data", async () => {
      const data = await accountAPI.listExports();

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/v2/exports?max_results=100",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );

      expect(data).to.deep.equal({
        results: [
          { ...testExport, destination_uri: "" },
          {
            ...testExport,
            state: "Complete",
            destination_uri: "s3://test-bucket/some/key",
          },
        ],
        next_token: "456",
      });
    });

    it("should support nextToken", async () => {
      await accountAPI.listExports({ nextToken: "123" });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/v2/exports?max_results=100&next_token=123",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );
    });

    it("should support state", async () => {
      await accountAPI.listExports({
        state: ["Pending", "Complete"],
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/v2/exports?max_results=100&state=Pending&state=Complete",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );
    });
  });

  describe("getExport", () => {
    const testExport = {
      id: "419633606504219216",
      state: "Complete",
      database: "us-std/demo",
      format: "simple",
      destination: {
        s3: {
          bucket: "test-bucket",
          path: "some/key",
        },
      },
      created_at: "2025-01-09T19:57:22.735201Z",
      updated_at: "2025-01-09T19:07:25.642703Z",
    };

    it("should call the endpoint", async () => {
      fetch
        .withArgs(
          sinon.match({
            href: "https://account.fauna.com/v2/exports/419633606504219216",
          }),
          sinon.match({ method: "GET" }),
        )
        .resolves(f({ response: testExport }, 200));

      const data = await accountAPI.getExport({
        exportId: "419633606504219216",
      });

      expect(fetch).to.have.been.calledWith(
        sinon.match({
          href: "https://account.fauna.com/v2/exports/419633606504219216",
        }),
        sinon.match({
          method: "GET",
          headers: {
            Authorization: "Bearer some-account-key",
          },
        }),
      );
      expect(data).to.deep.equal({
        ...testExport,
        destination_uri: "s3://test-bucket/some/key",
      });
    });
  });
});
