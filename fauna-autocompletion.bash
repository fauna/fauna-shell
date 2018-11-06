#/usr/bin/env bash
# zsh users: autoload bashcompinit && bashcompinit

_fauna_completions()
{

  local first_word="${COMP_WORDS[1]}"
  local cur="${COMP_WORDS[COMP_CWORD]}"

  if [ "$first_word" == "shell" ] || \
     [ "$first_word" == "create-key" ] || \
     [ "$first_word" == "delete-database" ]; then
      
    local all_dbs=$(fauna list-databases | tail -n +2)
    COMPREPLY=( $(compgen -W "$all_dbs" -- ${cur}) )
    return
  fi

  local all_opts=("add-endpoint")
  all_opts+=("cloud-login")
  all_opts+=("create-database")
  all_opts+=("create-key")
  all_opts+=("default-endpoint")
  all_opts+=("delete-database")
  all_opts+=("delete-endpoint")
  all_opts+=("delete-key")
  all_opts+=("help")
  all_opts+=("list-databases")
  all_opts+=("list-endpoints")
  all_opts+=("list-keys")
  all_opts+=("run-queries")
  all_opts+=("shell")
  

  COMPREPLY=( $(compgen -W "$(echo ${all_opts[*]})" -- ${cur}) )
}

complete -F _fauna_completions -o bashdefault fauna
