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
printf 'CONTEXT_MODE_DIR=%s\n' "$CONTEXT_MODE_DIR" >>"$PI_LOG"
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

@test "run-warden help lists final command forms" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"help"* ]]
  [[ "$output" == *"doctor"* ]]
  [[ "$output" == *"shell init bash"* ]]
  [[ "$output" == *"shell init zsh"* ]]
  [[ "$output" == *"shell init fish"* ]]
  [[ "$output" == *"agents new [NAME]"* ]]
  [[ "$output" == *"agents list [--json]"* ]]
  [[ "$output" == *"agents NAME update-pi"* ]]
  [[ "$output" == *"agents NAME cwd DIR"* ]]
  [[ "$output" == *"agents NAME show [--json]"* ]]
  [[ "$output" == *"pi NAME [ARGS...]"* ]]
  [[ "$output" == *"worktree AGENT"* ]]
  [[ "$output" == *"@NAME [ARGS...]"* ]]
  [[ "$output" != *"shell snippet"* ]]
  [[ "$output" != *"agents update NAME"* ]]
  [[ "$output" != *"agents set NAME cwd DIR"* ]]
  [[ "$output" != *"agents unset NAME cwd"* ]]
}

@test "shell init prints manual shell snippets" {
  run env HOME="$TEST_HOME" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" shell init bash
  [ "$status" -eq 0 ]
  [[ "$output" == *"# warden begin"* ]]
  [[ "$output" == *"/tmp/warden/run-warden/shell/bash.sh"* ]]

  run env HOME="$TEST_HOME" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" shell init zsh
  [ "$status" -eq 0 ]
  [[ "$output" == *"/tmp/warden/run-warden/shell/zsh.sh"* ]]

  run env HOME="$TEST_HOME" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" shell init fish
  [ "$status" -eq 0 ]
  [[ "$output" == *"plugin-warden.fish"* ]]
  [[ "$output" == *"functions/warden.fish"* ]]
}

@test "removed command forms fail without stale compatibility usage" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" shell snippet bash
  [ "$status" -eq 2 ]
  [[ "$output" != *"usage: warden shell snippet"* ]]
  [[ "$output" != *"deprecated"* ]]

  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" agents update ada
  [ "$status" -eq 2 ]
  [[ "$output" != *"usage: warden agents update NAME"* ]]
  [[ "$output" != *"deprecated"* ]]

  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" agents set ada cwd /tmp
  [ "$status" -eq 2 ]
  [[ "$output" != *"usage: warden agents set NAME cwd DIR"* ]]
  [[ "$output" != *"deprecated"* ]]

  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" agents unset ada cwd
  [ "$status" -eq 2 ]
  [[ "$output" != *"usage: warden agents unset NAME cwd"* ]]
  [[ "$output" != *"deprecated"* ]]
}

@test "shell status doctor and install decline advertise shell init" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)

  run env HOME="$TEST_HOME" WARDEN_HOME="$repo_root" PATH="$FAKE_BIN:$PATH" "$RUN_WARDEN_ROOT/bin/warden" shell status
  [ "$status" -eq 0 ]
  [[ "$output" == *"manual: ./warden shell init bash"* ]]
  [[ "$output" != *"shell snippet"* ]]

  run env HOME="$TEST_HOME" WARDEN_HOME="$repo_root" PATH="$FAKE_BIN:$PATH" "$RUN_WARDEN_ROOT/bin/warden" doctor
  [ "$status" -eq 0 ]
  [[ "$output" == *"./warden shell init bash|zsh|fish"* ]]
  [[ "$output" != *"shell snippet"* ]]

  run env HOME="$TEST_HOME" WARDEN_HOME="$repo_root" PATH="$FAKE_BIN:$PATH" WARDEN_CURRENT_SHELL=bash "$RUN_WARDEN_ROOT/bin/warden" shell install
  [ "$status" -eq 0 ]
  [[ "$output" == *"shell integration declined. Manual snippets: ./warden shell init bash|zsh|fish"* ]]
  [[ "$output" != *"shell snippet"* ]]
}

@test "shell install and remove dispatch remain supported" {
  tmp_home="$BATS_TEST_TMPDIR/shell-home"
  mkdir -p "$tmp_home"

  run env HOME="$tmp_home" WARDEN_HOME=/tmp/warden WARDEN_CURRENT_SHELL=bash WARDEN_YES=1 "$RUN_WARDEN_ROOT/bin/warden" shell install
  [ "$status" -eq 0 ]
  [[ "$output" == *"installed - bash -> $tmp_home/.bashrc"* ]]
  grep -F "# warden begin" "$tmp_home/.bashrc"

  run env HOME="$tmp_home" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" shell remove
  [ "$status" -eq 0 ]
  [[ "$output" == *"removed - bash"* ]]
  ! grep -F "# warden begin" "$tmp_home/.bashrc"
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

@test "agents new seeds AGENTS.md from template with agent name only" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 0 ]
  [ -f "$agents/ada/AGENTS.md" ]
  node - "$RUN_WARDEN_ROOT/templates/AGENTS-template.md" "$agents/ada/AGENTS.md" <<'NODE'
const fs = require('fs');
const [templatePath, actualPath] = process.argv.slice(2);
const template = fs.readFileSync(templatePath, 'utf8');
const actual = fs.readFileSync(actualPath, 'utf8');
const expected = template.split('%agent_name%').join('ada');
if (actual !== expected) {
  console.error('AGENTS.md did not match template with %agent_name% replaced');
  process.exit(1);
}
if (actual.includes('%agent_name%')) {
  console.error('AGENTS.md still contains %agent_name%');
  process.exit(1);
}
for (const placeholder of ['%mission%', '%primary_scope%', '%out_of_scope%', '%testing%']) {
  if (!actual.includes(placeholder)) {
    console.error(`AGENTS.md missing untouched placeholder ${placeholder}`);
    process.exit(1);
  }
}
NODE
}

@test "agents new seeds guidance from runner root outside repository cwd" {
  agents="$BATS_TEST_TMPDIR/agents"
  elsewhere="$BATS_TEST_TMPDIR/elsewhere"
  mkdir -p "$elsewhere"
  cd "$elsewhere"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  [ "$status" -eq 0 ]
  grep -F "You are ada," "$agents/ada/AGENTS.md"
}

@test "agents NAME update-pi does not mutate existing AGENTS.md" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada
  printf '%s\n' 'unique guidance sentinel' >"$agents/ada/AGENTS.md"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents ada update-pi
  [ "$status" -eq 0 ]
  [ "$(cat "$agents/ada/AGENTS.md")" = "unique guidance sentinel" ]
}

@test "agents new fails before npm when AGENTS template is missing" {
  agents="$BATS_TEST_TMPDIR/agents"
  fixture_root="$BATS_TEST_TMPDIR/missing-template-fixture"
  mkdir -p "$fixture_root"
  cp -R "$RUN_WARDEN_ROOT" "$fixture_root/run-warden"
  rm -f "$fixture_root/run-warden/templates/AGENTS-template.md"
  expected_template="$fixture_root/run-warden/templates/AGENTS-template.md"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/missing-template-npm.log" "$fixture_root/run-warden/bin/warden" agents new ada
  [ "$status" -eq 1 ]
  [[ "$output" == *"warden: agent guidance template is missing or unreadable: $expected_template"* ]]
  [ ! -e "$agents/ada" ]
  [ ! -s "$BATS_TEST_TMPDIR/missing-template-npm.log" ]
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

@test "agents NAME update-pi reinstalls Warden-managed Pi runtime" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/install-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/update-npm.log" "$RUN_WARDEN_ROOT/bin/warden" agents ada update-pi
  [ "$status" -eq 0 ]
  [[ "$output" == *"updated agent ada Pi"* ]]
  [ -x "$agents/ada/npm/node_modules/.bin/pi" ]
  grep -F "arg=--prefix" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=$agents/ada/npm" "$BATS_TEST_TMPDIR/update-npm.log"
  grep -F "arg=@earendil-works/pi-coding-agent@latest" "$BATS_TEST_TMPDIR/update-npm.log"
}

@test "agents NAME update-pi requires an existing agent name" {
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents ada update-pi extra
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden agents NAME update-pi"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents missing update-pi
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
  [[ "$output" == *"usage: warden agents new [NAME]"* ]]
}

@test "run-warden help keeps final pi and agents command order" {
  run env HOME="$TEST_HOME" "$RUN_WARDEN_ROOT/bin/warden" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"agents new [NAME]"* ]]
  [[ "$output" == *"agents list [--json]"* ]]
  [[ "$output" == *"agents NAME update-pi"* ]]
  [[ "$output" == *"agents NAME cwd DIR"* ]]
  [[ "$output" == *"agents NAME show [--json]"* ]]
  [[ "$output" == *"pi NAME [ARGS...]"* ]]
  [[ "$output" == *"worktree AGENT"* ]]
  [[ "$output" == *"@NAME [ARGS...]"* ]]
}

make_worktree_fixture() {
  WORKTREE_REPO="$BATS_TEST_TMPDIR/repo"
  WORKTREE_LINKED="$BATS_TEST_TMPDIR/linked worktree"
  WORKTREE_DETACHED="$BATS_TEST_TMPDIR/detached-worktree"

  git init -b main "$WORKTREE_REPO" >/dev/null
  git -C "$WORKTREE_REPO" config user.email warden@example.invalid
  git -C "$WORKTREE_REPO" config user.name Warden
  printf '%s\n' initial >"$WORKTREE_REPO/file.txt"
  git -C "$WORKTREE_REPO" add file.txt
  git -C "$WORKTREE_REPO" commit -m initial >/dev/null
  git -C "$WORKTREE_REPO" worktree add -b topic "$WORKTREE_LINKED" >/dev/null
  git -C "$WORKTREE_REPO" worktree add --detach "$WORKTREE_DETACHED" HEAD >/dev/null
}

make_agent_with_cwd() {
  agents=$1
  name=$2
  cwd=$3
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm-$name.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi-$name.log" "$RUN_WARDEN_ROOT/bin/warden" agents new "$name" >/dev/null
  cat >"$agents/$name/settings.json" <<JSON
{"theme":"dark","warden":{"agent":{"cwd":"$cwd"},"keep":true}}
JSON
}

@test "worktree rejects missing and extra agent arguments" {
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" "$RUN_WARDEN_ROOT/bin/warden" worktree
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden worktree AGENT"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" "$RUN_WARDEN_ROOT/bin/warden" worktree ada extra
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden worktree AGENT"* ]]
}

@test "worktree requires existing agent configured cwd and git worktree" {
  agents="$BATS_TEST_TMPDIR/agents"
  nongit="$BATS_TEST_TMPDIR/not-git"
  mkdir -p "$agents/nocwd/npm/node_modules/.bin" "$nongit"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree missing
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent not found"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree nocwd
  [ "$status" -eq 2 ]
  [[ "$output" == *"configured cwd is required"* ]]

  make_agent_with_cwd "$agents" ada "$nongit"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada
  [ "$status" -eq 2 ]
  [[ "$output" == *"configured cwd is not a Git worktree or repository"* ]]
}

@test "worktree lists branches fallbacks and launches existing selection from exact path" {
  agents="$BATS_TEST_TMPDIR/agents"
  make_worktree_fixture
  make_agent_with_cwd "$agents" ada "$WORKTREE_REPO"
  before_settings=$(cat "$agents/ada/settings.json")

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-worktree.log" "$RUN_WARDEN_ROOT/bin/warden" worktree ada <<<"3"
  [ "$status" -eq 0 ]
  [[ "$output" == *"1) main - $WORKTREE_REPO"* ]]
  [[ "$output" == *"2) (detached) - $WORKTREE_DETACHED"* ]]
  [[ "$output" == *"3) topic - $WORKTREE_LINKED"* ]]
  [[ "$output" == *"4) create new worktree for repo"* ]]
  grep -F "PWD=$WORKTREE_LINKED" "$BATS_TEST_TMPDIR/pi-worktree.log"
  grep -F "PI_CODING_AGENT_DIR=$agents/ada" "$BATS_TEST_TMPDIR/pi-worktree.log"
  [ "$(cat "$agents/ada/settings.json")" = "$before_settings" ]
}

@test "worktree new option captures validated dry-run inputs without creating worktree" {
  agents="$BATS_TEST_TMPDIR/agents"
  make_worktree_fixture
  make_agent_with_cwd "$agents" ada "$WORKTREE_REPO"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada <<'EOF'
4
issue-123-fix
2
EOF
  [ "$status" -eq 0 ]
  [[ "$output" == *"worktree folder"* ]]
  [[ "$output" == *"Example: issue-123-fix"* ]]
  [[ "$output" == *"no spaces"* ]]
  [[ "$output" == *"branch type"* ]]
  [[ "$output" == *"dry-run"* ]]
  [[ "$output" == *"no branch is created"* ]]
  [[ "$output" == *"agent: ada"* ]]
  [[ "$output" == *"source: repo"* ]]
  [[ "$output" == *"name: issue-123-fix"* ]]
  [[ "$output" == *"type: bugfix"* ]]
  [[ "$output" == *"no worktree created"* ]]
  ! git -C "$WORKTREE_REPO" worktree list --porcelain | grep -F "issue-123-fix"
  [ ! -e "$BATS_TEST_TMPDIR/issue-123-fix" ]
}

@test "worktree invalid choices names types and eof fail clearly" {
  agents="$BATS_TEST_TMPDIR/agents"
  make_worktree_fixture
  make_agent_with_cwd "$agents" ada "$WORKTREE_REPO"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada <<<"99"
  [ "$status" -eq 2 ]
  [[ "$output" == *"invalid worktree choice"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada <<'EOF'
4
Bad_Name
EOF
  [ "$status" -eq 2 ]
  [[ "$output" == *"invalid worktree name"* ]]
  [[ "$output" == *"lowercase letters"* ]]
  [[ "$output" == *"numbers"* ]]
  [[ "$output" == *"hyphens"* ]]
  [[ "$output" == *"no spaces"* ]]
  [[ "$output" == *"Example: issue-123-fix"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada <<'EOF'
4
valid-name
99
EOF
  [ "$status" -eq 2 ]
  [[ "$output" == *"invalid worktree type"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" worktree ada </dev/null
  [ "$status" -eq 2 ]
  [[ "$output" == *"unexpected EOF reading worktree choice"* ]]
}

@test "@NAME alias matches pi NAME argv and agent environment" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi-command.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada --flag "two words"
  [ "$status" -eq 0 ]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/at-command.log" "$RUN_WARDEN_ROOT/bin/warden" @ada --flag "two words"
  [ "$status" -eq 0 ]

  grep -F "PI_CODING_AGENT_DIR=$agents/ada" "$BATS_TEST_TMPDIR/at-command.log"
  grep -F "PILENS_DATA_DIR=$agents/ada/pi-lens" "$BATS_TEST_TMPDIR/at-command.log"
  grep -F "CONTEXT_MODE_DIR=$agents/ada/context-mode" "$BATS_TEST_TMPDIR/at-command.log"
  grep -F "arg=--flag" "$BATS_TEST_TMPDIR/at-command.log"
  grep -F "arg=two words" "$BATS_TEST_TMPDIR/at-command.log"
  diff -u "$BATS_TEST_TMPDIR/pi-command.log" "$BATS_TEST_TMPDIR/at-command.log"
}

@test "reserved agent names are rejected at create and launch entrypoints" {
  agents="$BATS_TEST_TMPDIR/agents"
  for reserved in new list; do
    run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm-$reserved.log" "$RUN_WARDEN_ROOT/bin/warden" agents new "$reserved"
    [ "$status" -eq 2 ]
    [[ "$output" == *"reserved agent name"* ]]
    [ ! -e "$agents/$reserved" ]

    run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" pi "$reserved" --help
    [ "$status" -eq 2 ]
    [[ "$output" == *"reserved agent name"* ]]

    run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" "@$reserved" --help
    [ "$status" -eq 2 ]
    [[ "$output" == *"reserved agent name"* ]]
  done
}

@test "pi runs local Pi with agent env and preserves argv" {
  agents="$BATS_TEST_TMPDIR/agents"
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/install-pi.log" "$RUN_WARDEN_ROOT/bin/warden" agents new ada

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$RUN_WARDEN_ROOT/bin/warden" pi ada --flag "two words"
  [ "$status" -eq 0 ]
  grep -F "PI_BIN=$agents/ada/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "PI_CODING_AGENT_DIR=$agents/ada" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "PILENS_DATA_DIR=$agents/ada/pi-lens" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "CONTEXT_MODE_DIR=$agents/ada/context-mode" "$BATS_TEST_TMPDIR/pi.log"
  [ -d "$agents/ada/pi-lens" ]
  [ -d "$agents/ada/context-mode" ]
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
  grep -F "CONTEXT_MODE_DIR=$agents/ada/context-mode" "$BATS_TEST_TMPDIR/pi.log"
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
  grep -F "PILENS_DATA_DIR=$agents/ada/pi-lens" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "CONTEXT_MODE_DIR=$agents/ada/context-mode" "$BATS_TEST_TMPDIR/pi.log"
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
  [[ "$output" == *"usage: warden pi NAME [ARGS...]"* ]]
}

@test "agents NAME cwd writes flattened agent cwd and preserves unrelated settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/sentinel" "$project"
  cat > "$agents/sentinel/settings.json" <<'JSON'
{"lastChangelogVersion":"1.2.3","packages":{"keep":true},"theme":"dark","defaultThinkingLevel":"high","warden":{"keep":true,"useNerdGlyphs":true}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel cwd "$project"
  [ "$status" -eq 0 ]
  [[ "$output" == *"set sentinel cwd: $project"* ]]
  node - "$agents/sentinel/settings.json" "$project" <<'NODE'
const fs = require('fs');
const [path, expected] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(path, 'utf8'));
if (settings.lastChangelogVersion !== '1.2.3') process.exit(1);
if (settings.packages.keep !== true) process.exit(1);
if (settings.theme !== 'dark') process.exit(1);
if (settings.defaultThinkingLevel !== 'high') process.exit(1);
if (settings.warden.keep !== true) process.exit(1);
if (settings.warden.useNerdGlyphs !== true) process.exit(1);
if (settings.warden.agent.cwd !== expected) process.exit(1);
NODE
}

@test "agents NAME cwd creates flattened agent settings and stores original input" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel" "$TEST_HOME/project"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel cwd "~/project"
  [ "$status" -eq 0 ]
  node - "$agents/sentinel/settings.json" <<'NODE'
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (settings.warden.agent.cwd !== '~/project') process.exit(1);
NODE
}

@test "agents NAME cwd rejects missing agents, relative cwd, and missing directories" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents missing cwd "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"agent not found"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel cwd relative/path
  [ "$status" -eq 2 ]
  [[ "$output" == *"cwd must be an absolute path or start with ~"* ]]

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel cwd "$BATS_TEST_TMPDIR/missing"
  [ "$status" -eq 2 ]
  [[ "$output" == *"cwd is not an existing directory"* ]]
}

@test "removed agents unset cwd surface does not mutate settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"
  cat > "$agents/sentinel/settings.json" <<'JSON'
{"lastChangelogVersion":"1.2.3","packages":{"keep":true},"theme":"dark","defaultThinkingLevel":"high","warden":{"useNerdGlyphs":true,"agent":{"cwd":"/tmp/old","note":"keep"}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents unset sentinel cwd
  [ "$status" -eq 2 ]
  [[ "$output" != *"unset sentinel cwd"* ]]
  node - "$agents/sentinel/settings.json" <<'NODE'
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (settings.warden.agent.cwd !== '/tmp/old') process.exit(1);
if (settings.warden.agent.note !== 'keep') process.exit(1);
NODE
}

@test "agents show prints directories and complete settings" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/sentinel/npm/node_modules/.bin" "$agents/sentinel/pi-lens" "$project"
  touch "$agents/sentinel/npm/node_modules/.bin/pi"
  chmod +x "$agents/sentinel/npm/node_modules/.bin/pi"
  cat > "$agents/sentinel/settings.json" <<JSON
{"warden":{"agent":{"cwd":"$project"}}}
JSON

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel show
  [ "$status" -eq 0 ]
  [[ "$output" == *"name: sentinel"* ]]
  [[ "$output" == *"agent dir: $agents/sentinel"* ]]
  [[ "$output" == *"pi bin: $agents/sentinel/npm/node_modules/.bin/pi"* ]]
  [[ "$output" == *"pi-lens dir: $agents/sentinel/pi-lens"* ]]
  [[ "$output" == *"context-mode dir: $agents/sentinel/context-mode"* ]]
  [[ "$output" == *"settings: $agents/sentinel/settings.json"* ]]
  [[ "$output" == *"configured cwd: $project"* ]]
  [[ "$output" == *"effective cwd: $project"* ]]
  [[ "$output" == *"settings.json:"* ]]
  [[ "$output" == *"\"cwd\": \"$project\""* ]]
}

@test "agents show handles missing settings and show json emits valid object" {
  agents="$BATS_TEST_TMPDIR/agents"
  mkdir -p "$agents/sentinel"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel show
  [ "$status" -eq 0 ]
  [[ "$output" == *"configured cwd: (unset)"* ]]
  [[ "$output" == *"{}"* ]]

  expected_cwd=$(pwd -P)
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents sentinel show --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" | node -e 'const expected = process.argv[1]; const expectedAgent = process.argv[2]; let data=""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => { const parsed = JSON.parse(data); if (parsed.name !== "sentinel") process.exit(1); if (!parsed.settingsPath.endsWith("/settings.json")) process.exit(1); if (parsed.effectiveCwd !== expected) process.exit(1); if (parsed.piLensDir !== `${expectedAgent}/pi-lens`) process.exit(1); if (parsed.contextModeDir !== `${expectedAgent}/context-mode`) process.exit(1); });' "$expected_cwd" "$agents/sentinel"
}

@test "agents list prints agents and list json emits valid array" {
  agents="$BATS_TEST_TMPDIR/agents"
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$agents/ada/npm/node_modules/.bin" "$agents/sentinel" "$project"
  touch "$agents/ada/npm/node_modules/.bin/pi"
  chmod +x "$agents/ada/npm/node_modules/.bin/pi"
  cat > "$agents/sentinel/settings.json" <<JSON
{"warden":{"agent":{"cwd":"$project"}}}
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
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents ada cwd "$project"
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
  env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_AGENTS="$agents" "$RUN_WARDEN_ROOT/bin/warden" agents ada cwd "~/project"

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
fs.writeFileSync(path, JSON.stringify({ warden: { agent: { cwd } } }));
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

@test "README files document final Pi agent commands" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  for doc in "$repo_root/README.md" "$RUN_WARDEN_ROOT/README.md"; do
    grep -F "warden agents new [NAME]" "$doc"
    grep -F "warden agents list [--json]" "$doc"
    grep -F "warden agents NAME update-pi" "$doc"
    grep -F "warden agents NAME cwd DIR" "$doc"
    grep -F "warden agents NAME show [--json]" "$doc"
    grep -F "warden pi NAME" "$doc"
    grep -F "warden worktree AGENT" "$doc"
    grep -F "warden @NAME" "$doc"
    ! grep -F "warden agents update <name>" "$doc"
    ! grep -F "warden agents set <name> cwd <dir>" "$doc"
    ! grep -F "warden agents unset <name> cwd" "$doc"
    ! grep -F "warden shell snippet" "$doc"
  done
  grep -F "renames the current tmux window" "$repo_root/README.md"
  grep -F "WARDEN_AGENTS" "$repo_root/README.md"
  grep -F "CONTEXT_MODE_DIR" "$repo_root/README.md"
  grep -F "warden.agent.cwd" "$repo_root/README.md"
}

@test "pi-warden docs keep runner bootstrap out of package scope" {
  repo_root=$(cd "$RUN_WARDEN_ROOT/.." && pwd -P)
  grep -F "run-warden" "$repo_root/pi-warden/README.md"
  grep -F "not the agent-environment bootstrap" "$repo_root/pi-warden/AGENTS.md"
}
