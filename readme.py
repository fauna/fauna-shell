import re
import subprocess

def run(command: list[str]) -> str:
  result = subprocess.check_output(command)
  return result.decode("utf8")

with open("README.md", "r") as file:
  data = file.read()

subprocess.call("yarn build", shell=True)

in_commands = False
i = 0
lines = data.split("\n")
command = ""
while i < len(lines):
  line = lines[i]
  i += 1
  if line == "<!-- commands -->":
    in_commands = True

  if not in_commands:
    continue

  if line == "<!-- commandsstop -->":
    break

  match = re.search("###? `(.+)`", line)
  if match != None:
    command = match.group(1).split(" ")

  if line == "```sh":
    start = i
    end = None
    while i < len(lines):
      line = lines[i]
      i += 1
      if line == "```":
        end = i - 1
        break

    if end != None:
      print(f"updated command {command}")
      result = run(["./bin/run", *command[1:], "--help"]).strip().split("\n")
      lines[start:end] = result
      i += len(result) - (end - start)

with open("README.md", "w") as file:
  file.write("\n".join(lines))
