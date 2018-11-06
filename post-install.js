const path = require('path')
const globalModules = require('global-modules')

var filename = `${globalModules}${path.sep}fauna-shell${path.sep}fauna-autocompletion.bash`

console.log(`
To enable fauna CLI bash completion, load the script in your ~/.profile:
(zsh users can enable bash completion before source it with: autoload bashcompinit && bashcompinit)

  [[ -s ${filename} ]] && \\
  source ${filename}
`)
