#!/usr/bin/env bash
node --experimental-sea-config ./sea/sea-config.json
cp "$(command -v node)" ./dist/fauna
codesign --remove-signature ./dist/fauna
npx postject ./dist/fauna NODE_SEA_BLOB ./dist/sea.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA
codesign --sign - ./dist/fauna
