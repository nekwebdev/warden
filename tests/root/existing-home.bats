#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  mkdir -p "$FAKE_BIN" "$TEST_HOME"
  printf '#!/usr/bin/env sh\nexit 0\n' > "$FAKE_BIN/mise"
  chmod +x "$FAKE_BIN/mise"
}

@test "existing unrelated WARDEN_HOME is not overwritten" {
  clone="$BATS_TEST_TMPDIR/clone"
  target="$BATS_TEST_TMPDIR/existing"
  mkdir -p "$clone" "$target"
  (cd "$REPO_ROOT" && tar --exclude .git -cf - .) | (cd "$clone" && tar -xf -)
  chmod +x "$clone/warden"
  echo keep > "$target/sentinel"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$target" "$clone/warden"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Nothing was overwritten"* ]]
  [ "$(cat "$target/sentinel")" = "keep" ]
}
