import { expect } from "chai";
import {
  cleanupDBs,
  evalOk,
  newDB,
  shellErr,
  shellOk,
  stripMargin,
} from "./base";

// FIXME: Once we get `nock` out of here, we need to revive this test. It works
// fine locally, but it causes the entire test run to freeze in CI.
describe.skip("fauna schema staged commands", () => {
  // Cleanup after ourselves.
  after(async function () {
    await cleanupDBs();
  });

  it("fauna schema push --stage --no-input works", async () => {
    const secret = await newDB();

    await shellOk(
      "fauna schema push --dir test/integ/schema/start --no-input",
      secret
    );

    expect(
      await evalOk("Collection.all().map(.name).toArray()", secret)
    ).to.deep.equal(["User"]);

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --no-input --stage",
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
      "fauna schema push --dir test/integ/schema/start --no-input",
      secret
    );

    expect(await status(secret)).to.equal(
      stripMargin(
        `|Status: none
         |`
      )
    );

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --no-input --stage",
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

  it("fauna schema commit --no-input works", async () => {
    const secret = await newDB();

    await shellOk(
      "fauna schema push --dir test/integ/schema/start --no-input",
      secret
    );

    await evalOk(
      "User.create({ id: 0, name: 'Alice', email: 'alice@example.com' })",
      secret
    );

    expect(
      await evalOk("Collection.all().map(.name).toArray()", secret)
    ).to.deep.equal(["User"]);

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --no-input --stage",
      secret
    );

    // The index should not be visible on the companion object.
    expect(
      await evalOk(
        stripMargin(
          `|let user: Any = User
           |user.byName`
        ),
        secret
      )
    ).to.deep.equal(null);

    // Commit the schema
    await shellOk("fauna schema commit --dir . --no-input", secret);

    // Index should now be available on the companion object.
    expect(
      await evalOk(
        stripMargin(`User.byName('Alice').toArray().map(.id)`),
        secret
      )
    ).to.deep.equal(["0"]);

    // Status should be blank now.
    expect(await status(secret)).to.equal(
      stripMargin(
        `|Status: none
         |`
      )
    );

    // Comitting when there is nothing staged should return an error.
    expect(
      await shellErr("fauna schema commit --dir . --no-input", secret)
    ).to.equal("There is no staged schema to commit");
  });

  it("fauna schema abandon --no-input works", async () => {
    const secret = await newDB();

    await shellOk(
      "fauna schema push --dir test/integ/schema/start --no-input",
      secret
    );

    await evalOk(
      "User.create({ id: 0, name: 'Alice', email: 'alice@example.com' })",
      secret
    );

    expect(
      await evalOk("Collection.all().map(.name).toArray()", secret)
    ).to.deep.equal(["User"]);

    await shellOk(
      "fauna schema push --dir test/integ/schema/staged_index --no-input --stage",
      secret
    );

    // The index should be visible on the definition object.
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

    // But not visible on the companion object.
    expect(
      await evalOk(
        stripMargin(
          `|let user: Any = User
           |user.byName`
        ),
        secret
      )
    ).to.deep.equal(null);

    // Abandon the schema
    await shellOk("fauna schema abandon --dir . --no-input", secret);

    // Index should no longer be in the definition object.
    expect(
      await evalOk("Collection.byName('User')!.indexes.byName", secret)
    ).to.deep.equal(null);
    expect(
      await evalOk(
        stripMargin(
          `|let user: Any = User
           |user.byName`
        ),
        secret
      )
    ).to.deep.equal(null);

    // Status should be blank now.
    expect(await status(secret)).to.equal(
      stripMargin(
        `|Status: none
         |`
      )
    );

    // Abandoning when there is no staged schema should return an error.
    expect(
      await shellErr("fauna schema abandon --dir . --no-input", secret)
    ).to.equal("There is no staged schema to abandon");
  });
});
