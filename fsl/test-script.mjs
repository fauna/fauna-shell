#!/usr/bin/env zx

/**
  * This is provided in the pipeline to pass in the built version of the
  * fauna CLI to be tested.
  */
let faunaCmd;
if (argv._.length === 1) {
  faunaCmd = `${argv._[0]}`
} else {
  faunaCmd = "fauna"
}

const expectedCollNames = ["bye", "hi"]
const expectedFuncNames = ["sayHello"]
const secretFlag = process.env.FAUNA_SECRET
if (secretFlag) {
  $.verbose = false
  console.log("A secret was found for FAUNA_SECRET, it will be used for all fauna CLI commands")
}


await ensureClean()

/**
  * Test Push
  */
await execFaunaCmd(["schema", "push", "--force"])
const collNames = await execPaginated("Collection.all().map(.name).order()")
if (collNames.length != expectedCollNames.length || !collNames.every((elem, idx) => elem === expectedCollNames[idx])) {
  throw new Error(`Schema collections do not match actual: ${collNames} expected: ${expectedCollNames}`)
}
const funcNames = await execPaginated("Function.all().map(.name)")
if (funcNames.length != expectedFuncNames.length || !funcNames.every((elem, idx) => elem === expectedFuncNames[idx])) {
  throw new Error(`Schema functions do not match actual: ${collNames} expected: ${expectedCollNames}`)
}

await $`rm schema/*`

/**
 * Test Pull
 * When using execFaunaCmd writing to stdin in this way
 * doesn't appear to work...
 */
let pullProcess;
if (secretFlag) {
  pullProcess = $`${faunaCmd} schema pull --secret ${secretFlag}`
} else {
  pullProcess = $`${faunaCmd} schema pull`
}
pullProcess.stdin.write('yes\n')
pullProcess.stdin.end()
await sleep(10000)
const schemaFiles = (await $`ls schema`).stdout.trim().split('\n')
if (schemaFiles.length !== 2 || schemaFiles[0] !== "collections.fsl" || schemaFiles[1] !== "sayHelloFunction.fsl") {
  throw new Error(`Schema files after pull did not equal expected.  Expected: ['collections.fsl, 'sayHelloFunction.fsl'] Actual: ${schemaFiles}`)
}
console.log("Schema tests run successfully!")

async function ensureClean() {
  await execFQL(`
    Collection.all().forEach(.delete())
    Role.all().forEach(.delete())
    Function.all().forEach(.delete())
  `)
  // await execFQL("Collection.create({ name: 'hi' })")
  const respColls = await execPaginated("Collection.all() { name }")
  if (!Array.isArray(respColls) || respColls.length != 0) {
    throw new Error(`Expected empty collection set. ${respColls}`)
  }
  const respFunctions = await execPaginated("Function.all() { name }")
  if (!Array.isArray(respFunctions) || respFunctions.length != 0) {
    throw new Error(`Expected empty function set. ${resp}`)
  }
}

/**
  * The provided cmd must be an array where each string you want to show up
  * in the shell is an element.
  * ex: execFaunaCmd(["schema", "diff"])
  */
async function execFaunaCmd(cmd) {
  if (secretFlag) {
    return $`${faunaCmd} ${cmd} --secret ${secretFlag}`
  } else {
    return $`${faunaCmd} ${cmd}`
  }
}

async function execPaginated(fql) {
  const resp = await execFQL(fql)
  return resp?.data
}

async function execFQL(fql) {
  const resp = secretFlag ? await $`${faunaCmd} eval ${fql} --format=json --secret ${secretFlag}` : await $`${faunaCmd} eval ${fql} --format=json`
  const respParsed = JSON.parse(resp._stdout)
  return respParsed
}
