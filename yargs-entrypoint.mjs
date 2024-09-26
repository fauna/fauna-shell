#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from './cli.mjs'
import { setupRealContainer as setupContainer } from './src/config/setup-container.mjs'

run(hideBin(process.argv), setupContainer())
