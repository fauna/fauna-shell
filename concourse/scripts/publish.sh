#!/bin/sh

set -eou

cd ./fauna-shell-repository

yarn install
yarn build

PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
NPM_LATEST_VERSION=$(npm view fauna-shell version)
echo "Current package version: $PACKAGE_VERSION"
echo "Latest version in npm: $NPM_LATEST_VERSION"

if [ "$PACKAGE_VERSION" \> "$NPM_LATEST_VERSION" ]
then
  echo "Publishing a new version..."
  echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
  npm publish
  rm .npmrc
else
  echo "NPM package already published on npm with version ${NPM_LATEST_VERSION}" 1>&2
  exit 1
fi
