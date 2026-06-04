#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  chmod +x "$REPO_ROOT/run-warden/bin/warden"
}

@test "shell snippet preserves custom WARDEN_HOME" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$BATS_TEST_TMPDIR/custom home" "$REPO_ROOT/run-warden/bin/warden" shell snippet bash
  [ "$status" -eq 0 ]
  [[ "$output" == *"# warden begin"* ]]
  [[ "$output" == *"export WARDEN_HOME="* ]]
  [[ "$output" == *"custom home"* ]]
}

@test "shell snippets default WARDEN_HOME to XDG data home" {
  run env -u WARDEN_HOME HOME="$BATS_TEST_TMPDIR/home" XDG_DATA_HOME="$BATS_TEST_TMPDIR/xdg-data" PATH=/usr/bin /bin/sh -c '. "$1"; printf "%s\n" "$WARDEN_HOME"' sh "$REPO_ROOT/run-warden/shell/bash.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "$BATS_TEST_TMPDIR/xdg-data/warden" ]

  run env -u WARDEN_HOME HOME="$BATS_TEST_TMPDIR/home" XDG_DATA_HOME="$BATS_TEST_TMPDIR/xdg-data" PATH=/usr/bin /bin/sh -c '. "$1"; printf "%s\n" "$WARDEN_HOME"' sh "$REPO_ROOT/run-warden/shell/zsh.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "$BATS_TEST_TMPDIR/xdg-data/warden" ]
}

@test "shell snippet rejects unsupported shell names with usage" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" "$REPO_ROOT/run-warden/bin/warden" shell snippet tcsh
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: warden shell snippet bash|zsh|fish"* ]]
}

@test "bash and zsh snippets keep PATH idempotent" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" PATH=/usr/bin /bin/sh -c '. "$1"; . "$1"; printf "%s\n" "$PATH"' sh "$REPO_ROOT/run-warden/shell/bash.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "$REPO_ROOT/run-warden/bin:/usr/bin" ]

  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" PATH=/usr/bin /bin/sh -c '. "$1"; . "$1"; printf "%s\n" "$PATH"' sh "$REPO_ROOT/run-warden/shell/zsh.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "$REPO_ROOT/run-warden/bin:/usr/bin" ]
}

@test "fish snippet prints managed file contents without guarded block" {
  run env -u XDG_CONFIG_HOME HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" "$REPO_ROOT/run-warden/bin/warden" shell snippet fish
  [ "$status" -eq 0 ]
  [[ "$output" == *".config/fish/conf.d/plugin-warden.fish"* ]]
  [[ "$output" == *".config/fish/functions/warden.fish"* ]]
  [[ "$output" == *"# warden fish integration"* ]]
  [[ "$output" != *"# warden begin"* ]]
}

@test "shell install writes selected existing shell targets after consent env" {
  mkdir -p "$BATS_TEST_TMPDIR/home" "$BATS_TEST_TMPDIR/zdotdir" "$BATS_TEST_TMPDIR/xdg-config/fish"
  touch "$BATS_TEST_TMPDIR/home/.bashrc" "$BATS_TEST_TMPDIR/zdotdir/.zshrc"
  run env HOME="$BATS_TEST_TMPDIR/home" ZDOTDIR="$BATS_TEST_TMPDIR/zdotdir" XDG_CONFIG_HOME="$BATS_TEST_TMPDIR/xdg-config" WARDEN_HOME="$REPO_ROOT" WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/warden" shell install
  [ "$status" -eq 0 ]
  grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.bashrc"
  grep -F '# warden begin' "$BATS_TEST_TMPDIR/zdotdir/.zshrc"
  [ ! -e "$BATS_TEST_TMPDIR/home/.zshrc" ]
  grep -F '# warden fish integration' "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish"
  grep -F '# warden fish function' "$BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish"
}

@test "shell install reports existing integration and skipped missing shells" {
  mkdir -p "$BATS_TEST_TMPDIR/home"
  cat > "$BATS_TEST_TMPDIR/home/.bashrc" <<'SH'
# keep
# warden begin
export WARDEN_HOME='/already'
. '/already/run-warden/shell/bash.sh'
# warden end
SH
  run env HOME="$BATS_TEST_TMPDIR/home" XDG_CONFIG_HOME="$BATS_TEST_TMPDIR/xdg-missing" WARDEN_HOME="$REPO_ROOT" WARDEN_CURRENT_SHELL=/bin/bash WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/warden" shell install
  [ "$status" -eq 0 ]
  [[ "$output" == *"already installed - bash -> $BATS_TEST_TMPDIR/home/.bashrc"* ]]
  [[ "$output" == *"skipped - zsh shell environment not detected ($BATS_TEST_TMPDIR/home/.zshrc missing)"* ]]
  [[ "$output" == *"skipped - fish shell environment not detected ($BATS_TEST_TMPDIR/xdg-missing/fish missing)"* ]]
  [ "$(grep -c '# warden begin' "$BATS_TEST_TMPDIR/home/.bashrc")" -eq 1 ]
}

@test "shell install reports existing fish files without overwriting" {
  mkdir -p "$BATS_TEST_TMPDIR/home" "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d" "$BATS_TEST_TMPDIR/xdg-config/fish/functions"
  echo keep-conf > "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish"
  echo keep-function > "$BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish"
  run env HOME="$BATS_TEST_TMPDIR/home" XDG_CONFIG_HOME="$BATS_TEST_TMPDIR/xdg-config" WARDEN_HOME="$REPO_ROOT" WARDEN_CURRENT_SHELL=/usr/bin/fish WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/warden" shell install
  [ "$status" -eq 0 ]
  [[ "$output" == *"already installed - fish -> $BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish"* ]]
  [[ "$output" == *"already installed - fish -> $BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish"* ]]
  [ "$(cat "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish")" = "keep-conf" ]
  [ "$(cat "$BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish")" = "keep-function" ]
}

@test "shell install defaults detected fish to yes and other shells to no" {
  run python3 - "$REPO_ROOT" "$BATS_TEST_TMPDIR/home" "$BATS_TEST_TMPDIR/xdg-config" <<'PY'
import os
import pty
import select
import subprocess
import sys
import time

repo, home, xdg_config = sys.argv[1:4]
os.makedirs(home, exist_ok=True)
env = os.environ.copy()
env.update({
    "HOME": home,
    "XDG_CONFIG_HOME": xdg_config,
    "WARDEN_HOME": repo,
    "WARDEN_CURRENT_SHELL": "/usr/bin/fish",
    "SHELL": "/bin/bash",
})
env.pop("WARDEN_YES", None)
master, slave = pty.openpty()
proc = subprocess.Popen(
    [f"{repo}/run-warden/bin/warden", "shell", "install"],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    env=env,
)
os.close(slave)
time.sleep(0.2)
os.write(master, b"\n\n\n")
output = b""
deadline = time.time() + 5
while time.time() < deadline:
    ready, _, _ = select.select([master], [], [], 0.1)
    if ready:
        try:
            chunk = os.read(master, 4096)
        except OSError:
            break
        if not chunk:
            break
        output += chunk
    if proc.poll() is not None:
        while True:
            ready, _, _ = select.select([master], [], [], 0)
            if not ready:
                break
            try:
                chunk = os.read(master, 4096)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
        break
if proc.poll() is None:
    proc.kill()
    proc.wait()
sys.stdout.write(output.decode(errors="replace"))
sys.exit(proc.returncode)
PY
  [ "$status" -eq 0 ]
  [[ "$output" == *"Fish detected, do you want to install fish integration? [Y/n]"* ]]
  [[ "$output" != *"Install bash integration too?"* ]]
  [[ "$output" != *"Install zsh integration too?"* ]]
  grep -F '# warden fish integration' "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish"
  grep -F '# warden fish function' "$BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish"
  [ ! -e "$BATS_TEST_TMPDIR/home/.bashrc" ]
  [ ! -e "$BATS_TEST_TMPDIR/home/.zshrc" ]
}

@test "shell remove deletes guarded blocks and managed fish files" {
  mkdir -p "$BATS_TEST_TMPDIR/home" "$BATS_TEST_TMPDIR/xdg-config/fish"
  touch "$BATS_TEST_TMPDIR/home/.bashrc" "$BATS_TEST_TMPDIR/home/.zshrc"
  env HOME="$BATS_TEST_TMPDIR/home" XDG_CONFIG_HOME="$BATS_TEST_TMPDIR/xdg-config" WARDEN_HOME="$REPO_ROOT" WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/warden" shell install
  run env HOME="$BATS_TEST_TMPDIR/home" XDG_CONFIG_HOME="$BATS_TEST_TMPDIR/xdg-config" WARDEN_HOME="$REPO_ROOT" "$REPO_ROOT/run-warden/bin/warden" shell remove
  [ "$status" -eq 0 ]
  ! grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.bashrc"
  ! grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.zshrc"
  [ ! -e "$BATS_TEST_TMPDIR/xdg-config/fish/conf.d/plugin-warden.fish" ]
  [ ! -e "$BATS_TEST_TMPDIR/xdg-config/fish/functions/warden.fish" ]
}
