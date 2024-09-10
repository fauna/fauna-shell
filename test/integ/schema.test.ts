import { expect } from "chai";
import { cleanupDBs, evalOk, newDB, shellOk, stripMargin } from "./base";

// FIXME: Once we get `nock` out of here, we need to revive this test. It works
// fine locally, but it causes the entire test run to freeze in CI.
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

  const status = async (secret: string) => {
    const output = await shellOk("fauna schema status --dir .", secret);

    // Remove the "Connected to endpoint" line.
    return output.split("\n").slice(1).join("\n");
  };

  it("fauna schema status works", async () => {
    const secret = await newDB();

    await shellOk(
      "fauna schema push --dir test/integ/schema/start --force",
      secret
    );

    expect(await status(secret)).to.equal(
      stripMargin(
        `|Status: none
         |`
      )
    );

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --force --stage",
      secret
    );

    expect(await status(secret)).to.equal(
      stripMargin(
        `|Status: ready
         |The schema is ready to be committed.
         |
         |Staged changes:
         |* Modifying collection \`User\` at 0:90/main.fsl:
         |  * Summary:
         |    + added: index \`byName\` (see diff)
         |
         |  * Diff:
         |      collection User {
         |        name: String
         |        email: String
         |    +
         |    +   index byName {
         |    +     terms [.name]
         |    +   }
         |      }
         |
         |
         |`
      )
    );
  });
});
