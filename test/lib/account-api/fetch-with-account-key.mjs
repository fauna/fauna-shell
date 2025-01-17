import * as awilix from "awilix";
import { expect } from "chai";
import sinon from "sinon";

import { setContainer } from "../../../src/config/container.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { fetchWithAccountKey } from "../../../src/lib/account-api.mjs";
import { f } from "../../helpers.mjs";

describe("fetchWithAccountKey", () => {
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

  it("should call the endpoint with the correct headers", async () => {
    await fetchWithAccountKey("https://account.fauna.com/api/v1/databases", {
      method: "GET",
    });

    expect(fetch).to.have.been.calledWith(
      "https://account.fauna.com/api/v1/databases",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer some-account-key",
        },
      },
    );
  });

  it("should retry once when the response is a 401", async () => {
    fetch
      .withArgs("https://account.fauna.com/api/v1/databases")
      .onCall(0)
      .resolves(f(null, 401));

    fetch
      .withArgs("https://account.fauna.com/api/v1/databases")
      .onCall(1)
      .resolves(f({ results: [] }, 200));

    const response = await fetchWithAccountKey(
      "https://account.fauna.com/api/v1/databases",
      {
        method: "GET",
      },
    );

    expect(fetch).to.have.been.calledWith(
      "https://account.fauna.com/api/v1/databases",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer some-account-key",
        },
      },
    );
    expect(fetch).to.have.been.calledWith(
      "https://account.fauna.com/api/v1/databases",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer new-account-key",
        },
      },
    );
    expect(await response.json()).to.deep.equal({ results: [] });
  });

  it("should only retry authorization errors once", async () => {
    fetch
      .withArgs("https://account.fauna.com/api/v1/databases")
      .resolves(f(null, 401));

    const response = await fetchWithAccountKey(
      "https://account.fauna.com/api/v1/databases",
      {
        method: "GET",
      },
    );

    expect(response.status).to.equal(401);
    expect(await response.json()).to.deep.equal(null);
  });
});
