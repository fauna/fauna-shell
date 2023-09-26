import { render } from "@inquirer/testing";
import { searchSelect } from "../../src/lib/search-select";
import { expect } from "chai";

describe("input prompt", () => {
  it("handle simple use case", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [{ value: "Alice" }, { value: "John" }, { value: "Jane" }],
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  John\n` +
        `  Jane`
    );

    events.type("J");
    expect(getScreen()).to.equal(`? What is your name J\n❯ John\n  Jane`);

    events.type("a");
    expect(getScreen()).to.equal(`? What is your name Ja\n❯ Jane`);

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Jane`);

    expect(await answer).to.equal("Jane");
  });

  it("can use arrow keys down", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [{ value: "Alice" }, { value: "John" }, { value: "Jane" }],
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  John\n` +
        `  Jane`
    );

    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n❯ John\n  Jane`
    );

    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n  John\n❯ Jane`
    );

    // Pressing down more stops scrolling, it does not wrap
    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n  John\n❯ Jane`
    );

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Jane`);

    expect(await answer).to.equal("Jane");
  });

  it("can use arrow keys up", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [{ value: "Alice" }, { value: "John" }, { value: "Jane" }],
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  John\n` +
        `  Jane`
    );

    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n❯ John\n  Jane`
    );

    events.keypress("up");
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Alice\n  John\n  Jane`
    );

    // Pressing up more stops scrolling, it does not wrap
    events.keypress("up");
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Alice\n  John\n  Jane`
    );

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Alice`);

    expect(await answer).to.equal("Alice");
  });

  it("can scroll", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [
        { value: "Alice" },
        { value: "Bob" },
        { value: "Carol" },
        { value: "Jhon" },
        { value: "Jane" },
      ],
      pageSize: 4,
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  Bob\n` +
        `  Carol\n` +
        `  Jhon`
    );

    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n❯ Bob\n  Carol\n  Jhon`
    );

    events.keypress("down");
    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n  Bob\n  Carol\n❯ Jhon`
    );

    // Scrolling!
    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Bob\n  Carol\n  Jhon\n❯ Jane`
    );

    events.keypress("up");
    expect(getScreen()).to.equal(
      `? What is your name\n  Bob\n  Carol\n❯ Jhon\n  Jane`
    );

    events.keypress("up");
    events.keypress("up");
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Bob\n  Carol\n  Jhon\n  Jane`
    );

    // And it can scroll up too
    events.keypress("up");
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Alice\n  Bob\n  Carol\n  Jhon`
    );

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Alice`);

    expect(await answer).to.equal("Alice");
  });

  it("can filter while scrolling", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [
        { value: "Alice" },
        { value: "Bob" },
        { value: "Carol" },
        { value: "Jhon" },
        { value: "Jane" },
      ],
      pageSize: 4,
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  Bob\n` +
        `  Carol\n` +
        `  Jhon`
    );

    events.keypress("down");
    events.keypress("down");
    events.keypress("down");
    events.keypress("down");
    expect(getScreen()).to.equal(
      `? What is your name\n  Bob\n  Carol\n  Jhon\n❯ Jane`
    );

    // This adds a filter, which needs to update the active and scroll states.
    events.type("J");
    expect(getScreen()).to.equal(`? What is your name J\n  Jhon\n❯ Jane`);

    // Things should behave as expected after that update.
    events.keypress("up");
    expect(getScreen()).to.equal(`? What is your name J\n❯ Jhon\n  Jane`);

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Jhon`);

    expect(await answer).to.equal("Jhon");
  });

  it("cannot press enter with no results", async () => {
    const { answer, events, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [{ value: "Alice" }, { value: "Bob" }, { value: "Carol" }],
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  Bob\n` +
        `  Carol`
    );

    events.type("J");
    expect(getScreen()).to.equal(`? What is your name J\n  <No results>`);

    // This does nothing
    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name J\n  <No results>`);

    events.keypress("backspace");
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Alice\n  Bob\n  Carol`
    );

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Alice`);

    expect(await answer).to.equal("Alice");
  });

  it("can use emacs keybinds", async () => {
    const { answer, events, input, getScreen } = await render(searchSelect, {
      message: "What is your name",
      choices: [{ value: "Alice" }, { value: "John" }, { value: "Jane" }],
    });

    expect(getScreen()).to.equal(
      `? What is your name (Type to filter, arrow keys to select)\n` +
        `❯ Alice\n` +
        `  John\n` +
        `  Jane`
    );

    input.emit("keypress", null, { name: "n", ctrl: true });
    expect(getScreen()).to.equal(
      `? What is your name\n  Alice\n❯ John\n  Jane`
    );

    input.emit("keypress", null, { name: "p", ctrl: true });
    expect(getScreen()).to.equal(
      `? What is your name\n❯ Alice\n  John\n  Jane`
    );

    events.keypress("enter");
    expect(getScreen()).to.equal(`? What is your name Alice`);

    expect(await answer).to.equal("Alice");
  });
});
