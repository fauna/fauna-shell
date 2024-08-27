import { runCommand } from "@oclif/test";
import { fail } from "assert";
import { env } from "process";

export type ShellResult = { stdout: string; stderr: string; ok: boolean };

const TEST_PREFIX = "fauna_shell_integ_test_";

export const newDB = async (secret?: string): Promise<string> => {
  const name = TEST_PREFIX + Math.floor(Math.random() * 1000000000);

  return evalOk<string>(
    stripMargin(
      `|if (Database.byName('${name}').exists()) {
       |  Database.byName('${name}').delete()
       |}
       |Database.create({ name: '${name}', typechecked: true })
       |Key.create({ role: 'admin', database: '${name}' }).secret
       |`
    ),
    secret
  );
};

export const cleanupDBs = async (): Promise<void> => {
  const { url, secret } = endpoint();

  const query = stripMargin(
    `|Database.all().forEach((db) => {
     |  if (db.name.startsWith('${TEST_PREFIX}')) {
     |    db.delete()
     |  }
     |})
     |`
  );

  const res = await fetch(new URL("/query/1", url), {
    method: "POST",
    headers: { AUTHORIZATION: `Bearer ${secret}` },
    body: JSON.stringify({ query }),
    // @ts-expect-error-next-line
    duplex: "half",
  });

  if (res.status !== 200) {
    fail(`Cleanup failed: ${await res.text()}`);
  }
};

export const evalOk = async <T>(code: string, secret?: string): Promise<T> => {
  const res = JSON.parse(
    await shellOk(`fauna eval "${code}" --format json`, secret)
  );
  // FIXME: This should really fail `shellOk`, but error handling is hard.
  if (res?.error) {
    fail(`Eval failed: ${res.summary}`);
  }

  return res;
};

export const shellOk = async (
  cmd: string,
  secret?: string
): Promise<string> => {
  const res = await shell(cmd, secret);
  if (!res.ok) {
    fail(`Command unexpectedly failed:\n${res.stderr}`);
  }

  return res.stdout;
};

export const shellErr = async (
  cmd: string,
  secret?: string
): Promise<string> => {
  const res = await shell(cmd, secret);
  if (res.ok) {
    fail(`Command should not have exitted succesfully:\n${res.stdout}`);
  }

  return res.stderr;
};

export const stripMargin = (str: string): string => {
  return str
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("|")) {
        return trimmed.slice(1);
      } else {
        return trimmed;
      }
    })
    .join("\n");
};

export const shell = async (
  cmd: string,
  secret?: string
): Promise<ShellResult> => {
  const parts = cmd.split(" ");
  if (parts[0] !== "fauna") {
    fail("Command must start with fauna");
  }

  const { url, secret: s } = endpoint();

  const opts = [
    parts.slice(1).join(" "),
    `--url ${url}`,
    `--secret ${secret ?? s}`,
  ];

  const out = await runCommand(opts);

  return {
    stdout: out.stdout,
    stderr: out.stderr + out.error?.message,
    ok: out.error === undefined,
  };
};

const endpoint = () => {
  return {
    url: `${env.FAUNA_SCHEME ?? "http"}://${env.FAUNA_DOMAIN ?? "127.0.0.1"}:${
      env.FAUNA_PORT ?? 8443
    }`,
    secret: env.FAUNA_SECRET ?? "secret",
  };
};
