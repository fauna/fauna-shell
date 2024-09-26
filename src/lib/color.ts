import { stdout } from "supports-color";

var colorEnabled: boolean | undefined = undefined;
export const disableColor = () => {
  colorEnabled = false;
};

// Enable or disable color. Passing undefined will enable colors if they are
// supported in the current environment.
export const setHasColor = (color: boolean | undefined) => {
  if (colorEnabled === undefined) {
    if (color === undefined) {
      // NB: `supports-color` is going to parse command line arguments on its own.
      colorEnabled = stdout !== false && stdout.hasBasic;
    } else {
      colorEnabled = color;
    }
  }
};

// The value for the `color` parameter to the `/schema/1` endpoints.
export const colorParam = (): string => {
  return hasColor() ? "ansi" : "";
};

export const hasColor = (): boolean => {
  return colorEnabled ?? false;
};

export const reset = (): string => esc(`\u001b[0m`);
export const bold = (): string => esc(`\u001b[1m`);

const esc = (str: string): string => {
  if (hasColor()) {
    return str;
  } else {
    return "";
  }
};
