//@ts-check

/**
 * AuthNZ helper functions and middleware
 * This should be easily extractable for usage in its own repository so it can be shared with VS
 * code plugin. Don't rely heavily on component injection.
 */

import { container } from "../../cli.mjs";
import FaunaClient from "../fauna-client.mjs";
import { CredsNotFoundError } from "../file-util.mjs";

export async function refreshDBKey({ profile, database, role }) {
  // DB key doesn't exist locally, or it's invalid. Create a new one, overwriting the old
  const secretCreds = container.resolve("secretCreds");
  const AccountClient = new (container.resolve("AccountClient"))(profile);
  const newSecret = await AccountClient.createKey({ path: database, role });
  const accountKey = getAccountKey(profile).accountKey;
  secretCreds.save({
    creds: {
      path: database,
      role,
      secret: newSecret.secret,
    },
    key: accountKey,
  });
  return newSecret;
}

export async function refreshSession(profile) {
  const makeAccountRequest = container.resolve("makeAccountRequest");
  const accountCreds = container.resolve("accountCreds");
  let { accountKey, refreshToken } = accountCreds.get({ key: profile });
  if (!refreshToken) {
    throw new Error(
      `Invalid access_keys file configuration for profile: ${profile}`,
    );
  }
  const newCreds = await makeAccountRequest({
    method: "POST",
    path: "/session/refresh",
    secret: refreshToken,
  });
  // If refresh token expired, this will throw InvalidCredsError
  accountKey = newCreds.account_key;
  refreshToken = newCreds.refresh_token;
  accountCreds.save({
    creds: {
      accountKey,
      refreshToken,
    },
    key: profile,
  });
  return { accountKey, refreshToken };
}

export function promptLogin(profile) {
  const logger = container.resolve("logger");
  const exit = container.resolve("exit");
  logger.stderr(
    `The requested profile ${profile || ""} is not signed in or has expired.\nPlease re-authenticate`,
  );
  logger.stdout(`To sign in, run:\n\nfauna login\n`);
  exit(1);
}

export function cleanupSecretsFile() {
  const accountCreds = container.resolve("accountCreds");
  const secretCreds = container.resolve("secretCreds");
  const accountKeys = accountCreds.get();
  const secretKeys = secretCreds.get();
  const accountKeysList = Object.values(accountKeys).map(
    ({ accountKey }) => accountKey,
  );
  Object.keys(secretKeys).forEach((accountKey) => {
    if (!accountKeysList.includes(accountKey)) {
      secretCreds.delete(accountKey);
    }
  });
}

export function getAccountKey(profile) {
  const accountCreds = container.resolve("accountCreds");
  try {
    const creds = accountCreds.get({ key: profile });
    return creds;
  } catch (e) {
    if (e instanceof CredsNotFoundError) {
      promptLogin(profile);
      // Throw InvalidCredsError back up to middleware entrypoint to prompt login
      // throw new InvalidCredsError();
    }
    e.message = `Error getting account key for ${profile}: ${e.message}`;
    throw e;
  }
}

export function getDBKey({ accountKey, path, role }) {
  const secretCreds = container.resolve("secretCreds");
  try {
    const existingCreds = secretCreds.get({ key: accountKey, path, role });
    // TODO: type here is the same format returned from FD createKey
    return {
      secret: existingCreds,
      path,
      role,
    };
  } catch (e) {
    if (e instanceof CredsNotFoundError) {
      return null;
    }
    e.message = `Error getting secret for ${accountKey} ${path} ${role}: ${e.message}`;
    throw e;
  }
}

export async function checkDBKeyRemote(dbKey, url) {
  const client = new FaunaClient({
    secret: dbKey,
    endpoint: url,
  });
  const result = await client.query("0");
  if (result.status === 200) {
    return result;
  }
  if (result.status === 401) {
    return null;
  } else {
    const errorCode = result.body?.error?.code || "internal_error";
    throw new Error(`Error contacting fauna [${result.status}]: ${errorCode}`);
  }
}
