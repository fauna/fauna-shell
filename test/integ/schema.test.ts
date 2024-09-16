import { expect } from "chai";
import { cleanupDBs, evalOk, newDB, shellOk, stripMargin } from "./base";

describe.skip("fauna schema staged commands", () => {
  // Cleanup after ourselves.
  after(async function () {
    await cleanupDBs();
  });

  it("fauna schema push --stage --force works", async () => {
    const secret = await newDB();

    await shellOk(
      "fauna schema push --dir test/integ/schema/start --force",
      secret
    );

    expect(
      await evalOk("Collection.all().map(.name).toArray()", secret)
    ).to.deep.equal(["User"]);

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --force --stage",
      secret
    );

    // Index should be in the FQL definition.
    expect(
      await evalOk("Collection.byName('User')!.indexes.byName", secret)
    ).to.deep.equal({
      terms: [
        {
          field: ".name",
          mva: false,
        },
      ],
      queryable: true,
      status: "complete",
    });

    // But, the index should not be visible on the companion object.
    expect(
      await evalOk(
        stripMargin(
          `|let user: Any = User
           |user.byName`
        ),
        secret
      )
    ).to.deep.equal(null);
  });
});
