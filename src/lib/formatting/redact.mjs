/**
 * Redacts a string by replacing everything except the first and last four characters with asterisks.
 * If the string is too short to display both the first and last four characters, the first four
 * are displayed and the rest are redacted. If its less than 12 characters, the whole string is redacted.
 *
 * @param {string} text - The string to redact.
 * @returns {string} The redacted string.
 */
export function redact(text) {
  if (!text) return text;

  // If the string is less than 12 characters long, it is completely replaced with asterisks.
  // This is so we can guarantee that the redacted string is at least 8 characters long.
  // This aligns with minimum password lengths.
  if (text.length < 12) {
    return "*".repeat(text.length);
  }

  // If the string is less than 16, we can't redact both, so display the last four only.
  if (text.length < 16) {
    const lastFour = text.slice(-4);
    return `${"*".repeat(text.length - 4)}${lastFour}`;
  }

  // Otherwise, redact the middle of the string and keep the first and last four characters.
  const firstFour = text.slice(0, 4);
  const lastFour = text.slice(-4);
  const middleLength = text.length - 8;
  return `${firstFour}${"*".repeat(middleLength)}${lastFour}`;
}

/**
 * Stringifies an object and redacts any keys that contain the word "secret".
 *
 * @param {*} obj - The object to stringify.
 * @param {((key, value) => value) | null} [replacer] - A function that can be used to modify the value of each key before it is redacted.
 * @param {number} [space] - The number of spaces to use for indentation.
 * @returns {string} The redacted string.
 */
export function redactedStringify(obj, replacer, space) {
  // If replacer is not provided, use a default function that returns the value unchanged
  const resolvedReplaced = replacer ? replacer : (_key, value) => value;

  // Now we can stringify using our redact function and the resolved replacer
  return JSON.stringify(
    obj,
    (key, value) => {
      const normalizedKey = key
        .toLowerCase()
        .replace(/_/g, "")
        .replace(/-/g, "");
      if (
        normalizedKey.includes("secret") ||
        normalizedKey.includes("accountkey")
      ) {
        return redact(resolvedReplaced(key, value));
      }
      return resolvedReplaced(key, value);
    },
    space,
  );
}
