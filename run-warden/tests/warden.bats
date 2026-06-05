#!/usr/bin/env bats

setup() {
  RUN_WARDEN_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P)
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$TEST_HOME" "$FAKE_BIN"
  chmod +x "$RUN_WARDEN_ROOT/bin/warden"
  unset TMUX TMUX_PANE

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
[ -z "${PI_EXIT:-}" ] || exit "$PI_EXIT"
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

  cat > "$FAKE_BIN/tmux" <<'SH'
#!/usr/bin/env sh
if [ -n "${TMUX_LOG:-}" ]; then
  printf 'argc=%s\n' "$#" >>"$TMUX_LOG"
  for arg do printf 'arg=%s\n' "$arg" >>"$TMUX_LOG"; done
fi
[ -z "${TMUX_EXIT:-}" ] || exit "$TMUX_EXIT"
case "${1:-}" in
  display-message) printf '%s\n' "${TMUX_WINDOW_NAME:-zsh}" ;;
  show-window-option) printf '%s\n' "${TMUX_AUTOMATIC_RENAME:-on}" ;;
esac
exit 0
SH
  chmod +x "$FAKE_BIN/tmux"
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

@test "run-warden help lists agents commands" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"agents new [NAME]"* ]]
  [[ "$output" == *"agents update NAME"* ]]
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

@test "agents update reinstalls Warden-managed Pi runtime" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents update ada
  [ "$status" -eq 0 ]
  [[ "$output" == *"updated agent ada Pi"* ]]
  [ -x "$agents/ada/npm/node_modules/.bin/pi" ]
  grep -F "arg=--prefix" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=$agents/ada/npm" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=@earendil-works/pi-coding-agent@latest" "$BATS_TEST_TMPDIR/update-npm.log"
}

@test "agents update requires an existing agent name" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents update
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden agents update NAME"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents update missing
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent not found"* ]]
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
  [[ "$output" == *"agents set NAME cwd DIR"* ]]
  [[ "$output" == *"agents unset NAME cwd"* ]]
  [[ "$output" == *"agents show NAME [--json]"* ]]
  [[ "$output" == *"agents list [--json]"* ]]
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

@test "pi prefixes tmux window and resets after launch" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new sentinel

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" TMUX=/tmp/tmux TMUX_LOG="$BATS_TEST_TMPDIR/tmux.log" TMUX_WINDOW_NAME=shell TMUX_AUTOMATIC_RENAME=on "$RUN_WARDEN_ROOT/bin/warden" pi sentinel --flag
  [ "$status" -eq 0 ]
  grep -F "arg=rename-window" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=󱚤 sentinel" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=shell" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=set-window-option" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=automatic-rename" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=on" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=--flag" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi resets tmux window after Pi failure" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new sentinel

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" PI_EXIT=7 TMUX=/tmp/tmux TMUX_LOG="$BATS_TEST_TMPDIR/tmux.log" TMUX_WINDOW_NAME=shell "$RUN_WARDEN_ROOT/bin/warden" pi sentinel
  [ "$status" -eq 7 ]
  grep -F "arg=󱚤 sentinel" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "arg=shell" "$BATS_TEST_TMPDIR/tmux.log"
}

@test "pi skips tmux rename outside tmux" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new sentinel

  run env -u TMUX HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" TMUX_LOG="$BATS_TEST_TMPDIR/tmux.log" "$RUN_WARDEN_ROOT/bin/warden" pi sentinel
  [ "$status" -eq 0 ]
  [ ! -e "$BATS_TEST_TMPDIR/tmux.log" ]
  grep -F "PI_BIN=$agents/sentinel/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi ignores tmux rename failures" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new sentinel

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" TMUX=/tmp/tmux TMUX_LOG="$BATS_TEST_TMPDIR/tmux.log" TMUX_EXIT=9 "$RUN_WARDEN_ROOT/bin/warden" pi sentinel
  [ "$status" -eq 0 ]
  grep -F "arg=rename-window" "$BATS_TEST_TMPDIR/tmux.log"
  grep -F "PI_BIN=$agents/sentinel/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi update updates packages then Warden-managed Pi runtime" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada update
  [ "$status" -eq 0 ]
  grep -F "PI_BIN=$agents/ada/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "argc=2" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=update" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=--extensions" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=$agents/ada/npm" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=@earendil-works/pi-coding-agent@latest" "$BATS_TEST_TMPDIR/update-npm.log"
}

@test "pi update self target updates only Warden-managed Pi runtime" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada update --self
  [ "$status" -eq 0 ]
  [ ! -e "$BATS_TEST_TMPDIR/pi.log" ]
  grep -F "arg=$agents/ada/npm" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=@earendil-works/pi-coding-agent@latest" "$BATS_TEST_TMPDIR/update-npm.log"
}

@test "pi update extensions target delegates only to Pi" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada update --extensions
  [ "$status" -eq 0 ]
  [ ! -e "$BATS_TEST_TMPDIR/update-npm.log" ]
  grep -F "argc=2" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=update" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=--extensions" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi update skips runtime update when package update fails" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" PI_EXIT=7 "$RUN_WARDEN_ROOT/bin/warden" pi ada update
  [ "$status" -eq 7 ]
  [ ! -e "$BATS_TEST_TMPDIR/update-npm.log" ]
  grep -F "arg=--extensions" "$BATS_TEST_TMPDIR/pi.log"
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

@test "agents set cwd writes nested agent settings and preserves existing settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/sentinel" "$project"
  cat > "$agents/sentinel/settings.json" <<'JSON'
{"theme":"dark","warden":{"keep":true,"agents":{"other":{"cwd":"/tmp/other"},"sentinel":{"note":"keep"}}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set sentinel cwd "$project"
  [ "$status" -eq 0 ]
  [[ "$output" == *"set sentinel cwd: $project"* ]]
  node - "$agents/sentinel/settings.json" "$project" <<'NODE'
const fs = require('fs');
const [path, expected] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(path, 'utf8'));
if (settings.theme !== 'dark') process.exit(1);
if (settings.warden.keep !== true) process.exit(1);
if (settings.warden.agents.other.cwd !== '/tmp/other') process.exit(1);
if (settings.warden.agents.sentinel.note !== 'keep') process.exit(1);
if (settings.warden.agents.sentinel.cwd !== expected) process.exit(1);
NODE
}

@test "agents set cwd accepts tilde paths and stores original input" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel" "$TEST_HOME/project"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set sentinel cwd "~/project"
  [ "$status" -eq 0 ]
  node - "$agents/sentinel/settings.json" <<'NODE'
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (settings.warden.agents.sentinel.cwd !== '~/project') process.exit(1);
NODE
}

@test "agents set cwd rejects missing agents, relative cwd, and missing directories" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set missing cwd "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent not found"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set sentinel cwd relative/path
  [ "$status" -eq 2 ]
  [[ "$output" == *"cwd must be an absolute path or start with ~"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set sentinel cwd "$BATS_TEST_TMPDIR/missing"
  [ "$status" -eq 2 ]
  [[ "$output" == *"cwd is not an existing directory"* ]]
}

@test "agents unset cwd removes only cwd and preserves unrelated settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"
  cat > "$agents/sentinel/settings.json" <<'JSON'
{"theme":"dark","warden":{"agents":{"sentinel":{"cwd":"/tmp/old","note":"keep"},"other":{"cwd":"/tmp/other"}}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents unset sentinel cwd
  [ "$status" -eq 0 ]
  [[ "$output" == *"unset sentinel cwd"* ]]
  node - "$agents/sentinel/settings.json" <<'NODE'
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (settings.theme !== 'dark') process.exit(1);
if ('cwd' in settings.warden.agents.sentinel) process.exit(1);
if (settings.warden.agents.sentinel.note !== 'keep') process.exit(1);
if (settings.warden.agents.other.cwd !== '/tmp/other') process.exit(1);
NODE
}

@test "agents show prints directories and complete settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/sentinel/npm/node_modules/.bin" "$agents/sentinel/pi-lens" "$project"
  touch "$agents/sentinel/npm/node_modules/.bin/pi"
  chmod +x "$agents/sentinel/npm/node_modules/.bin/pi"
  cat > "$agents/sentinel/settings.json" <<JSON
{"warden":{"agents":{"sentinel":{"cwd":"$project"}}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents show sentinel
  [ "$status" -eq 0 ]
  [[ "$output" == *"name: sentinel"* ]]
  [[ "$output" == *"agent dir: $agents/sentinel"* ]]
  [[ "$output" == *"pi bin: $agents/sentinel/npm/node_modules/.bin/pi"* ]]
  [[ "$output" == *"pi-lens dir: $agents/sentinel/pi-lens"* ]]
  [[ "$output" == *"settings: $agents/sentinel/settings.json"* ]]
  [[ "$output" == *"configured cwd: $project"* ]]
  [[ "$output" == *"effective cwd: $project"* ]]
  [[ "$output" == *"settings.json:"* ]]
  [[ "$output" == *"\"cwd\": \"$project\""* ]]
}

@test "agents show handles missing settings and show json emits valid object" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents show sentinel
  [ "$status" -eq 0 ]
  [[ "$output" == *"configured cwd: (unset)"* ]]
  [[ "$output" == *"{}"* ]]

  expected_cwd=$(pwd -P)
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents show sentinel --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" | node -e 'const expected = process.argv[1]; let data=""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => { const parsed = JSON.parse(data); if (parsed.name !== "sentinel") process.exit(1); if (!parsed.settingsPath.endsWith("/settings.json")) process.exit(1); if (parsed.effectiveCwd !== expected) process.exit(1); });' "$expected_cwd"
}

@test "agents list prints agents and list json emits valid array" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/ada/npm/node_modules/.bin" "$agents/sentinel" "$project"
  touch "$agents/ada/npm/node_modules/.bin/pi"
  chmod +x "$agents/ada/npm/node_modules/.bin/pi"
  cat > "$agents/sentinel/settings.json" <<JSON
{"warden":{"agents":{"sentinel":{"cwd":"$project"}}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents list
  [ "$status" -eq 0 ]
  [[ "$output" == *"ada"* ]]
  [[ "$output" == *"sentinel"* ]]
  [[ "$output" == *"cwd=$project"* ]]
  [[ "$output" == *"status=missing-pi"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents list --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" | node -e 'let data=""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => { const parsed = JSON.parse(data); if (!Array.isArray(parsed)) process.exit(1); if (!parsed.some(a => a.name === "sentinel")) process.exit(1); });'
}

@test "pi uses configured cwd and keeps caller cwd when unset" {
  agents="$BATS_TEST_TMPDIR/agents"
  caller="$BATS_TEST_TMPDIR/caller"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$caller" "$project"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  cd "$caller"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-unset.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 0 ]
  grep -F "PWD=$caller" "$BATS_TEST_TMPDIR/pi-unset.log"

  cd "$BATS_TEST_TMPDIR"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set ada cwd "$project"
  [ "$status" -eq 0 ]

  cd "$caller"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-set.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 0 ]
  grep -F "PWD=$project" "$BATS_TEST_TMPDIR/pi-set.log"
}

@test "pi expands tilde cwd before launch" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$TEST_HOME/project"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents set ada cwd "~/project"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 0 ]
  grep -F "PWD=$TEST_HOME/project" "$BATS_TEST_TMPDIR/pi.log"
}

@test "pi fails clearly for missing cwd or malformed settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  node - "$agents/ada/settings.json" "$BATS_TEST_TMPDIR/missing" <<'NODE'
const fs = require('fs');
const [path, cwd] = process.argv.slice(2);
fs.writeFileSync(path, JSON.stringify({ warden: { agents: { ada: { cwd } } } }));
NODE

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-missing.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 2 ]
  [[ "$output" == *"configured cwd is not an existing directory"* ]]
  [ ! -e "$BATS_TEST_TMPDIR/pi-missing.log" ]

  printf '{bad json' > "$agents/ada/settings.json"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-malformed.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada
  [ "$status" -eq 1 ]
  [[ "$output" == *"failed to read agent settings"* ]]
  [ ! -e "$BATS_TEST_TMPDIR/pi-malformed.log" ]
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
  grep -F "warden agents update <name>" "$repo_root/README.md"
  grep -F "warden agents set <name> cwd <dir>" "$repo_root/README.md"
  grep -F "warden agents unset <name> cwd" "$repo_root/README.md"
  grep -F "warden agents show <name> [--json]" "$repo_root/README.md"
  grep -F "warden agents list [--json]" "$repo_root/README.md"
  grep -F "warden pi <name>" "$repo_root/README.md"
  grep -F "renames the current tmux window" "$repo_root/README.md"
  grep -F "WARDEN_AGENTS" "$repo_root/README.md"
  grep -F "warden.agents.<name>.cwd" "$repo_root/README.md"
}

@test "pi-warden docs keep runner bootstrap out of package scope" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  grep -F "run-warden" "$repo_root/pi-warden/README.md"
  grep -F "not the agent-environment bootstrap" "$repo_root/pi-warden/AGENTS.md"
}
