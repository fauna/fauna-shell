/**
 * AuthNZ helper functions and middleware
 * This should be easily extractable for usage in its own repository so it can be shared with VS
 * code plugin. Don't rely heavily on component injection.
 */

import { container } from "../../cli.mjs";
import FaunaClient from "../fauna-client.mjs";
import { CredsNotFoundError } from "../file-util.mjs";
import { InvalidCredsError } from "../misc.mjs";

export async function authNZMiddleware(argv) {
  if (!argv.authRequired) {
    return argv;
  }
  // Use flags to get/validate/refresh/create account and db secrets. Cleanup creds files.
  // Make sure required keys are there so handlers have no issue accesssing/using.
  const { profile, database, role, url } = argv;
  // TODO: for any args that aren't passed in, get them from configuration files
  try {
    const accountKey = await setAccountKey(profile);
    if (database) {
      await setDBKey({ accountKey, path: database, role, url });
    }
  } catch (e) {
    // Should prompt login when
    // 1. Account key is not found in creds file
    // 2. Account key is found but it and refresh token are invalid/expired
    if (e instanceof InvalidCredsError) {
      promptLogin(profile);
    } else {
      e.message = `Error in authNZMiddleware: ${e.message}`;
      throw e;
    }
  }
  return argv;
}

function promptLogin(profile) {
  const logger = container.resolve("logger");
  const exit = container.resolve("exit");
  logger.stderr(
    `The requested profile "${profile}" is not signed in or has expired.\nPlease re-authenticate`,
  );
  logger.stdout(`To sign in, run:\n\nfauna login --profile ${profile}\n`);
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

// TODO: account for env var for account key. if profile isn't defined.
export async function setAccountKey(profile) {
  // Don't leave hanging db secrets that don't match up to stored account keys
  cleanupSecretsFile();
  const accountCreds = container.resolve("accountCreds");
  // If account key is not found, this will throw InvalidCredsError and prompt login
  const existingKey = getAccountKey(profile);
  // If account key is invalid, this will throw InvalidCredsError
  const accountKeyValid = await checkAccountKeyRemote(existingKey);
  if (accountKeyValid) {
    return existingKey;
  } else {
    const newAccountKey = await refreshSession(profile);
    accountCreds.save({
      creds: newAccountKey,
      key: profile,
    });
    return newAccountKey.account_key;
  }
}

export function getAccountKey(profile) {
  const accountCreds = container.resolve("accountCreds");
  try {
    const creds = accountCreds.get({ key: profile });
    return creds.accountKey;
  } catch (e) {
    if (e instanceof CredsNotFoundError) {
      // Throw InvalidCredsError back up to middleware entrypoint to prompt login
      throw new InvalidCredsError();
    }
    e.message = `Error getting account key for ${profile}: ${e.message}`;
    throw e;
  }
}

async function checkAccountKeyRemote(accountKey) {
  const accountClient = container.resolve("accountClient");
  // If account key is invalid or expired, this will throw InvalidCredsError
  try {
    return await accountClient.whoAmI(accountKey);
  } catch (e) {
    if (e instanceof InvalidCredsError) {
      // Return null to indicate account key is invalid and we will try to refresh it
      return null;
    }
    throw e;
  }
}

async function refreshSession(profile) {
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const creds = accountCreds.get({ key: profile });
  const { refresh_token: refreshToken } = creds;
  if (!refreshToken) {
    throw new Error(
      `Invalid access_keys file configuration for profile: ${profile}`,
    );
  }
  // If refresh token expired, this will throw InvalidCredsError
  const newCreds = await accountClient.refreshSession(refreshToken);
  return newCreds;
}

async function setDBKey({ accountKey, path, role, url }) {
  const secretCreds = container.resolve("secretCreds");
  const accountClient = container.resolve("accountClient");
  const existingSecret = getDBKey({ accountKey, path, role });
  if (existingSecret) {
    // If this throws an error, user
    const dbKeyIsValid = await checkDBKeyRemote(existingSecret.secret, url);
    if (dbKeyIsValid) {
      return existingSecret;
    }
  }
  // DB key doesn't exist locally, or it's invalid. Create a new one, overwriting the old
  const newSecret = await accountClient.createKey({
    accountKey,
    path,
    role,
  });
  secretCreds.save({
    creds: {
      path,
      role,
      secret: newSecret.secret,
    },
    key: accountKey,
  });
  return newSecret;
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
