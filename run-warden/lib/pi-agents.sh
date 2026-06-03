PI_AGENT_PACKAGE="@earendil-works/pi-coding-agent"

warden_agents_root() {
	if [ -n "${WARDEN_AGENTS:-}" ]; then
		printf '%s\n' "$WARDEN_AGENTS"
	elif [ -n "${XDG_CONFIG_HOME:-}" ]; then
		printf '%s/pi-agents\n' "$XDG_CONFIG_HOME"
	else
		printf '%s/.config/pi-agents\n' "$HOME"
	fi
}

warden_agents_ensure_root() {
	agents_root=$(warden_agents_root)
	mkdir -p "$agents_root" || return 1
	(cd "$agents_root" && pwd -P) || return 1
}

warden_agent_validate_name() {
	name=${1:-}
	case "$name" in
	"" | "." | ".." | */*)
		printf '%s\n' "warden: invalid agent name: $name" >&2
		printf '%s\n' "Agent names must use A-Z, a-z, 0-9, dot, underscore, or dash; '/' and path segments '.'/'..' are not allowed." >&2
		return 2
		;;
	*[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-]*)
		printf '%s\n' "warden: invalid agent name: $name" >&2
		printf '%s\n' "Agent names must use A-Z, a-z, 0-9, dot, underscore, or dash; '/' and path segments '.'/'..' are not allowed." >&2
		return 2
		;;
	esac
}

warden_agents_prompt_name() {
	if [ -n "${1:-}" ]; then
		printf '%s\n' "$1"
		return 0
	fi
	if [ ! -t 0 ]; then
		printf '%s\n' "usage: warden agents new [name]" >&2
		return 2
	fi
	printf 'Agent name: ' >&2
	read -r name
	if [ -z "$name" ]; then
		printf '%s\n' "warden: agent name is required" >&2
		return 2
	fi
	printf '%s\n' "$name"
}

warden_agent_dir() {
	agents_root=$1
	name=$2
	printf '%s/%s\n' "$agents_root" "$name"
}

warden_agent_npm_prefix() {
	agent_dir=$1
	printf '%s/npm\n' "$agent_dir"
}

warden_agent_pi_bin() {
	agent_dir=$1
	printf '%s/npm/node_modules/.bin/pi\n' "$agent_dir"
}

warden_agent_prepare_npm_config() {
	npm_prefix=$1
	mkdir -p "$npm_prefix" || return 1
	: >"$npm_prefix/.npmrc" || return 1
	: >"$npm_prefix/.npm-globalrc" || return 1
}

warden_agent_install_pi() {
	agent_dir=$1
	npm_prefix=$(warden_agent_npm_prefix "$agent_dir")
	warden_agent_prepare_npm_config "$npm_prefix" || return 1
	npm install \
		--prefix "$npm_prefix" \
		--cache "$npm_prefix/.npm-cache" \
		--userconfig "$npm_prefix/.npmrc" \
		--globalconfig "$npm_prefix/.npm-globalrc" \
		"$PI_AGENT_PACKAGE"
}

warden_agents_new() {
	if [ $# -gt 1 ]; then
		printf '%s\n' "usage: warden agents new [name]" >&2
		return 2
	fi
	name=$(warden_agents_prompt_name "${1:-}") || return $?
	warden_agent_validate_name "$name" || return $?

	agents_root=$(warden_agents_ensure_root) || return 1
	agent_dir=$(warden_agent_dir "$agents_root" "$name")
	if [ -e "$agent_dir" ]; then
		printf '%s\n' "warden: agent already exists: $agent_dir" >&2
		return 2
	fi

	mkdir "$agent_dir" || return 1
	mkdir -p "$agent_dir/pi-lens" || {
		rm -rf "$agent_dir"
		return 1
	}

	if ! warden_agent_install_pi "$agent_dir"; then
		rm -rf "$agent_dir"
		return 1
	fi

	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	if [ ! -x "$pi_bin" ]; then
		printf '%s\n' "warden: Pi install completed, but executable is missing: $pi_bin" >&2
		rm -rf "$agent_dir"
		return 1
	fi

	printf 'created agent %s at %s\n' "$name" "$agent_dir"
	printf 'pi executable: %s\n' "$pi_bin"
}

warden_agent_resolve_dir() {
	name=$1
	agents_root=$(warden_agents_root)
	if [ -d "$agents_root" ]; then
		agents_root=$(cd "$agents_root" && pwd -P) || return 1
	fi
	warden_agent_dir "$agents_root" "$name"
}

warden_pi() {
	if [ $# -lt 1 ]; then
		printf '%s\n' "usage: warden pi <name> [args...]" >&2
		return 2
	fi

	name=$1
	shift
	warden_agent_validate_name "$name" || return $?

	agent_dir=$(warden_agent_resolve_dir "$name") || return 1
	if [ ! -d "$agent_dir" ]; then
		printf '%s\n' "warden: agent not found: $agent_dir" >&2
		if ! warden_confirm "Create agent '$name' now?"; then
			printf '%s\n' "Create it with: warden agents new $name" >&2
			return 2
		fi
		warden_agents_new "$name" || return $?
		agents_root=$(warden_agents_ensure_root) || return 1
		agent_dir=$(warden_agent_dir "$agents_root" "$name")
	fi

	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	if [ ! -x "$pi_bin" ]; then
		printf '%s\n' "warden: Pi executable missing for agent '$name': $pi_bin" >&2
		printf '%s\n' "Remove or move the broken agent directory, then recreate it with: warden agents new $name" >&2
		return 1
	fi

	mkdir -p "$agent_dir/pi-lens" || return 1
	PI_CODING_AGENT_DIR="$agent_dir" PILENS_DATA_DIR="$agent_dir/pi-lens" exec "$pi_bin" "$@"
}
