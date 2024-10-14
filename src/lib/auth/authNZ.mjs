/**
 * AuthNZ helper (middleware?) for CLI
 */

import { container } from "../../cli.mjs";
import FaunaClient from "../fauna-client.mjs";
import { CredsNotFoundError } from "../file-util.mjs";

// As soon as possible, with or without profile flag, check accountKey validity with whoami
//  401 response prompts session refresh

// 401 from session refresh prompts login with specified user profile and Delete old account key and its db secrets

// If no account key for profile, prompt login

// If no db key for path and role, do key creation. 401 tells user no access or db/role doesn't exist

// If db found for path and role, do query
//  no access role code is 400. 401 is bad secret.

// If secrets file out of sync with account keys file, need to clean up secrets file... (they're all short lived and created automatically so no harm in just nuking all the secrets)

// "logout" a user where that user is not in accountkeys file but is in secrets file... must index secrets file by user

// create-key should specify ttl to frontdoor or in frontdoor we should shorten that down to minutes.

export function getAccountKeyLocal(profile) {
  const accountCreds = container.resolve("accountCreds");
  try {
    const creds = accountCreds.get({ key: profile });
    return creds.account_key;
  } catch (e) {
    if (e instanceof CredsNotFoundError) {
      return null;
    }
    e.message = `Error getting account key for ${profile}: ${e.message}`;
    throw e;
  }
}

export async function checkAccountKeyRemote(accountKey) {
  const accountClient = container.resolve("accountClient");
  try {
    return await accountClient.whoAmI(accountKey);
  } catch (e) {
    if (e instanceof CredsNotFoundError) {
      return null;
    }
    e.message = `Provided account key is invalid: ${e.message}`;
    throw e;
  }
}

async function refreshAccountKey() {}

export function getDBKeyLocal({ accountKey, path, role }) {
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

// Optional args
export function deleteDBKeyLocal({ accountKey, path, role }) {
  // const secretCreds = container.resolve;
}

export async function checkDBKeyRemote(dbKey, url) {
  console.log("url in check db", url);
  const client = new FaunaClient({
    secret: dbKey,
    endpoint: url,
  });

  // validate the client settings
  return await client.query("0");
}

async function refreshDBKey({ accountKey, path, role }) {
  await accountClient.createKey({
    accountKey,
    path: database,
    role,
  });
}
