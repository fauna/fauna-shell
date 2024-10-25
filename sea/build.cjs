/* eslint-disable no-console */

const os = require("node:os");
const { execSync: execSyncActual } = require("node:child_process");
const fs = require("node:fs");
const execSync = (command, options) =>
  execSyncActual(command, { ...options, encoding: "utf-8" });

const platform = os.platform();
const arch = os.arch();
if (platform === "linux") {
  console.log(`Building for Linux (${arch})...`);
  buildSEAForLinux();
} else if (platform === "darwin") {
  console.log(`Building for Mac (${arch})...`);
  buildSEAForMac();
} else if (platform === "win32") {
  console.log(`Building for Windows (${arch})...`);
  buildSEAForWindows();
} else {
  throw new Error(`No build configured for platform ${platform} and arch ${arch}!`);
}

function buildSEAForLinux() {
  execSync("node --experimental-sea-config ./sea/config.json");
  fs.copyFileSync(process.execPath, "./dist/fauna");
  execSync(
    "npx postject ./dist/fauna NODE_SEA_BLOB ./dist/sea.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  );
  execSync("chmod +x ./dist/fauna");
}

function buildSEAForMac() {
  execSync("node --experimental-sea-config ./sea/config.json");
  fs.copyFileSync(process.execPath, "./dist/fauna");
  execSync("codesign --remove-signature ./dist/fauna");
  execSync(
    "npx postject ./dist/fauna NODE_SEA_BLOB ./dist/sea.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA",
  );
  execSync("codesign --sign - ./dist/fauna");
  execSync("chmod +x ./dist/fauna");
}

function buildSEAForWindows() {
  execSync("node --experimental-sea-config .\\sea\\config.json");
  fs.copyFileSync(process.execPath, ".\\dist\\fauna.exe");
  // more details on signing:
  // https://learn.microsoft.com/en-us/dotnet/framework/wcf/feature-details/how-to-create-temporary-certificates-for-use-during-development#installing-a-certificate-in-the-trusted-root-certification-authorities-store
  // const signtool = "C:\\\"Program Files (x86)\"\\\"Microsoft SDKs\"\\ClickOnce\\SignTool\\signtool.exe";
  // execSync(`${signtool} remove /s /c /u .\\dist\\fauna.exe`);
  execSync(
    "npx postject .\\dist\\fauna.exe NODE_SEA_BLOB .\\dist\\sea.blob ^ \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  );
  // execSync(`${signtool} sign /fd SHA256 .\\dist\\fauna.exe`);
}
