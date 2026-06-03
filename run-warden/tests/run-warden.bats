#!/usr/bin/env bats

setup() {
  RUN_WARDEN_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P)
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$TEST_HOME" "$FAKE_BIN"
  chmod +x "$RUN_WARDEN_ROOT/bin/warden"

  cat > "$FAKE_BIN/npm" <<'SH'
#!/usr/bin/env sh
printf 'argc=%s\n' "$#" >>"$NPM_LOG"
for arg do printf 'arg=%s\n' "$arg" >>"$NPM_LOG"; done

prefix=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) shift; prefix=${1:-} ;;
  esac
  shift || break
done

[ -n "$prefix" ] || exit 64
mkdir -p "$prefix/node_modules/.bin"
cat > "$prefix/node_modules/.bin/pi" <<'PI'
#!/usr/bin/env sh
printf 'PI_BIN=%s\n' "$0" >>"$PI_LOG"
printf 'PI_CODING_AGENT_DIR=%s\n' "$PI_CODING_AGENT_DIR" >>"$PI_LOG"
printf 'PILENS_DATA_DIR=%s\n' "$PILENS_DATA_DIR" >>"$PI_LOG"
printf 'PWD=%s\n' "$(pwd)" >>"$PI_LOG"
printf 'argc=%s\n' "$#" >>"$PI_LOG"
for arg do printf 'arg=%s\n' "$arg" >>"$PI_LOG"; done
PI
chmod +x "$prefix/node_modules/.bin/pi"
SH
  chmod +x "$FAKE_BIN/npm"

  cat > "$FAKE_BIN/mise" <<'SH'
#!/usr/bin/env sh
if [ "$1" = "exec" ]; then shift; [ "$1" = "--" ] && shift; exec "$@"; fi
exit 0
SH
  chmod +x "$FAKE_BIN/mise"
}

@test "run-warden welcome prints WARDEN_HOME" {
  run env HOME="$TEST_HOME" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" welcome
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [[ "$output" == *"WARDEN_HOME: /tmp/warden"* ]]
}

@test "run-warden fails clearly when HOME is unset" {
  run env -u HOME WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" welcome
  [ "$status" -ne 0 ]
  [[ "$output" == *"HOME is required"* ]]
}

@test "run-warden rejects unknown command" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" nope
  [ "$status" -eq 2 ]
}

@test "run-warden help lists agents new" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"agents new [NAME]"* ]]
}

@test "agents new installs Pi into WARDEN_AGENTS local npm prefix" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 0 ]
  [[ "$output" == *"created agent ada at $agents/ada"* ]]
  [ -x "$agents/ada/npm/node_modules/.bin/pi" ]
  grep -F "arg=--prefix" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=$agents/ada/npm" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=--cache" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=$agents/ada/npm/.npm-cache" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=--userconfig" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=$agents/ada/npm/.npmrc" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=--globalconfig" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=$agents/ada/npm/.npm-globalrc" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "arg=@earendil-works/pi-coding-agent" "$BATS_TEST_TMPDIR/npm.log"
}

@test "agents new defaults to XDG pi-agents root" {
  xdg="$BATS_TEST_TMPDIR/xdg"
  run env -u WARDEN_AGENTS HOME="$TEST_HOME" XDG_CONFIG_HOME="$xdg" PATH="$FAKE_BIN:$PATH" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 0 ]
  [ -x "$xdg/pi-agents/ada/npm/node_modules/.bin/pi" ]
}

@test "agents new falls back to HOME config pi-agents root" {
  run env -u WARDEN_AGENTS -u XDG_CONFIG_HOME HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 0 ]
  [ -x "$TEST_HOME/.config/pi-agents/ada/npm/node_modules/.bin/pi" ]
}

@test "agents new rejects unsafe agent names" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ../bad
  [ "$status" -eq 2 ]
  [[ "$output" == *"invalid agent name"* ]]
  [ ! -d "$agents" ] || [ ! -e "$agents/../bad" ]
}

@test "agents new rejects existing agent directories" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/ada"
  echo keep >"$agents/ada/sentinel"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent already exists"* ]]
  [ "$(cat "$agents/ada/sentinel")" = "keep" ]
}

@test "agents new without name fails with usage in non-tty" {
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden agents new [name]"* ]]
}

@test "run-warden help lists pi command" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"pi NAME [ARGS...]"* ]]
}

@test "pi runs local Pi with agent env and preserves argv" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada --flag "two words"
  [ "$status" -eq 0 ]
  grep -F "PI_BIN=$agents/ada/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "PI_CODING_AGENT_DIR=$agents/ada" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "PILENS_DATA_DIR=$agents/ada/pi-lens" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=--flag" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=two words" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi missing agent creates after consent and then runs" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" WARDEN_YES=1 NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada --version
  [ "$status" -eq 0 ]
  [ -x "$agents/ada/npm/node_modules/.bin/pi" ]
  grep -F "arg=@earendil-works/pi-coding-agent" "$BATS_TEST_TMPDIR/npm.log"
  grep -F "PI_BIN=$agents/ada/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "PI_CODING_AGENT_DIR=$agents/ada" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=--version" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi missing agent declines creation in non-tty" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" pi ada --help
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent not found"* ]]
  [[ "$output" == *"Create it with: warden agents new ada"* ]]
  [ ! -e "$agents/ada" ]
}

@test "pi errors when local executable is missing" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/ada"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 1 ]
  [[ "$output" == *"Pi executable missing"* ]]
}

@test "pi without name fails with usage" {
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" "$RUN_WARDEN_ROOT/bin/warden" pi
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden pi <name> [args...]"* ]]
}

@test "doctor prints non-fatal Pi agent hints" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/ada/npm/node_modules/.bin" "$agents/.dotty/npm/node_modules/.bin" "$agents/broken"
  touch "$agents/ada/npm/node_modules/.bin/pi" "$agents/.dotty/npm/node_modules/.bin/pi"
  chmod +x "$agents/ada/npm/node_modules/.bin/pi" "$agents/.dotty/npm/node_modules/.bin/pi"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$repo_root" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" doctor
  [ "$status" -eq 0 ]
  [[ "$output" == *"info - WARDEN_AGENTS root: $agents"* ]]
  [[ "$output" == *"info - npm available for Pi agent installs"* ]]
  [[ "$output" == *"info - Pi agent ada has local executable: $agents/ada/npm/node_modules/.bin/pi"* ]]
  [[ "$output" == *"info - Pi agent .dotty has local executable: $agents/.dotty/npm/node_modules/.bin/pi"* ]]
  [[ "$output" == *"warn - Pi agent broken missing local executable: $agents/broken/npm/node_modules/.bin/pi"* ]]
}

@test "README documents Pi agent commands" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  grep -F "warden agents new [name]" "$repo_root/README.md"
  grep -F "warden pi <name>" "$repo_root/README.md"
  grep -F "WARDEN_AGENTS" "$repo_root/README.md"
}

@test "pi-warden docs keep runner bootstrap out of package scope" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  grep -F "run-warden" "$repo_root/pi-warden/README.md"
  grep -F "not the agent-environment bootstrap" "$repo_root/pi-warden/AGENTS.md"
}
