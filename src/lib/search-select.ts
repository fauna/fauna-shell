import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  useRef,
  isEnterKey,
  isBackspaceKey,
  KeypressEvent,
  type PromptConfig
} from "@inquirer/core";
import chalk from "chalk";
import figures from "figures";

export type Choice = {
  value: string;
};

export type SelectConfig = PromptConfig<{
  choices: ReadonlyArray<Choice>;
  pageSize?: number;
}>;

function renderItem({ item, isActive }: { item: Choice; isActive: boolean }) {
  const line = item.value;

  const prefix = isActive ? figures.pointer : ` `;
  const str = `${prefix} ${line}`;
  return isActive ? chalk.cyan(str) : str;
}

// @inquirer/core has these, but it includes the vim keybinds j and k, which
// conflict with typing those letters.
const isUpKey = (key: KeypressEvent): boolean =>
  key.name === "up" || // The up key
  (key.ctrl && key.name === "p"); // Emacs keybinding

const isDownKey = (key: KeypressEvent): boolean =>
  key.name === "down" || // The down key
  (key.ctrl && key.name === "n"); // Emacs keybinding

export const searchSelect = createPrompt<string, SelectConfig>(
  (config: SelectConfig, done: (_: string) => void) => {
    const { choices } = config;
    const pageSize = config.pageSize ?? 7;

    const firstRender = useRef(true);
    const prefix = usePrefix();
    const [status, setStatus] = useState<"pending" | "done">("pending");
    const [typed, setTyped] = useState("");

    // TODO: Fuzzy filter?
    const items = choices.filter((item, _) => item.value.startsWith(typed));

    // This is the item with a cursor next to it. The arrow keys will
    // increment/decrement this value.
    const [activeState, setActive] = useState(0);
    // This is the distance the amount that has been scrolled down. It is the
    // index of the first visible item.
    const [scrollState, setScroll] = useState(0);
    // `typed` can get updated, changing the length of `items`, without `active`
    // or `scroll` being updated. Its simplest just to truncate these values
    // here.
    const active = Math.min(activeState, items.length - 1);
    const scroll = Math.min(scrollState, items.length - pageSize);

    // Now that `active` has been truncated, we can just index into this without
    // worrying about undefined.
    const selectedChoice = items[active];

    useKeypress((key, rl) => {
      if (isEnterKey(key)) {
        if (items.length > 0) {
          setStatus("done");
          done(selectedChoice.value);
        }
      } else if (isUpKey(key) || isDownKey(key)) {
        const offset = isUpKey(key) ? -1 : 1;
        let next = Math.min(Math.max(0, active + offset), items.length - 1);
        setActive(next);
        if (next < scroll) {
          setScroll(next);
        } else if (next >= scroll + pageSize) {
          setScroll(next - pageSize + 1);
        }
      } else if (isBackspaceKey(key)) {
        if (typed.length > 0) {
          setTyped(typed.slice(0, typed.length - 1));
        }
      } else if (!key.ctrl) {
        setTyped(rl.line);
      }
    });

    let message = chalk.bold(config.message);
    if (firstRender.current) {
      firstRender.current = false;
      message += chalk.dim(" (Type to filter, arrow keys to select)");
    }

    if (status === "done") {
      return `${prefix} ${message} ${chalk.cyan(selectedChoice.value)}`;
    }

    const lines = items.map((item, index) =>
      renderItem({ item, isActive: index === active })
    );

    let page: string;
    if (lines.length === 0) {
      page = chalk.dim("  <No results>");
    } else if (lines.length > pageSize) {
      page = lines.slice(scroll, scroll + pageSize).join("\n");
    } else {
      page = lines.join("\n");
    }

    // Return value is an array of two elements, with the cursor rendered
    // between the two.
    return [`${prefix} ${message} ${typed}`, page];
  }
);
