warden_doctor_check() {
	label=$1
	shift
	if "$@"; then
		printf 'ok - %s\n' "$label"
		return 0
	fi
	printf 'not ok - %s\n' "$label"
	return 1
}

warden_has_mise() {
	command -v mise >/dev/null 2>&1 || [ -x "$HOME/.local/bin/mise" ]
}

warden_mise_exec_works() {
	if command -v mise >/dev/null 2>&1; then
		mise exec -- true >/dev/null 2>&1
		return $?
	fi
	if [ -x "$HOME/.local/bin/mise" ]; then
		"$HOME/.local/bin/mise" exec -- true >/dev/null 2>&1
		return $?
	fi
	return 1
}

warden_repo_is_home() {
	[ -n "${WARDEN_HOME:-}" ] && [ -x "$WARDEN_HOME/warden" ] && [ -d "$WARDEN_HOME/run-warden" ]
}

warden_runner_delegates() {
	[ -n "${WARDEN_HOME:-}" ] && [ -x "$WARDEN_HOME/run-warden/bin/warden" ]
}

warden_shell_has_any_integration() {
	warden_shell_is_installed bash || warden_shell_is_installed zsh || warden_shell_is_installed fish
}

warden_doctor_pi_agent_hints() {
	agents_root=$(warden_agents_root)
	printf 'info - WARDEN_AGENTS root: %s\n' "$agents_root"

	if command -v npm >/dev/null 2>&1; then
		printf 'info - npm available for Pi agent installs\n'
	else
		printf 'warn - npm unavailable; warden agents new will fail until npm is installed\n'
	fi

	if [ ! -d "$agents_root" ]; then
		printf 'info - no Pi agents created yet\n'
		return 0
	fi

	found=0
	for agent_dir in "$agents_root"/* "$agents_root"/.[!.]* "$agents_root"/..?*; do
		[ -d "$agent_dir" ] || continue
		found=1
		agent_name=${agent_dir##*/}
		pi_bin=$(warden_agent_pi_bin "$agent_dir")
		if [ -x "$pi_bin" ]; then
			printf 'info - Pi agent %s has local executable: %s\n' "$agent_name" "$pi_bin"
		else
			printf 'warn - Pi agent %s missing local executable: %s\n' "$agent_name" "$pi_bin"
		fi
	done

	if [ "$found" -eq 0 ]; then
		printf 'info - no Pi agents created yet\n'
	fi
}

warden_doctor() {
	failures=0
	warden_doctor_check "WARDEN_HOME is set" test -n "${WARDEN_HOME:-}" || failures=$((failures + 1))
	warden_doctor_check "WARDEN_HOME exists" test -d "${WARDEN_HOME:-/dev/null}" || failures=$((failures + 1))
	warden_doctor_check "repo is located at WARDEN_HOME" warden_repo_is_home || failures=$((failures + 1))
	warden_doctor_check "mise is available" warden_has_mise || failures=$((failures + 1))
	warden_doctor_check "mise exec works" warden_mise_exec_works || failures=$((failures + 1))
	warden_doctor_check "run-warden delegation is available" warden_runner_delegates || failures=$((failures + 1))
	if warden_shell_has_any_integration; then
		printf 'ok - shell integration installed for at least one shell\n'
	else
		printf 'not ok - shell integration not installed; run ./warden shell install or ./warden shell init bash|zsh|fish\n'
	fi
	warden_doctor_pi_agent_hints
	[ "$failures" -eq 0 ]
}
