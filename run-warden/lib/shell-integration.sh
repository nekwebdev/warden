WARDEN_SHELL_MARKER_BEGIN="# warden begin"
WARDEN_SHELL_MARKER_END="# warden end"

warden_confirm() {
	prompt=$1
	default=${2:-no}
	if [ "${WARDEN_YES:-}" = "1" ]; then return 0; fi
	if [ ! -t 0 ]; then return 1; fi
	case "$default" in
	yes) prompt_suffix='[Y/n]' ;;
	*) prompt_suffix='[y/N]' ;;
	esac
	printf '%s %s ' "$prompt" "$prompt_suffix" >&2
	read -r answer
	case "$answer" in
	"") [ "$default" = "yes" ] ;;
	y | Y | yes | YES) return 0 ;;
	*) return 1 ;;
	esac
}

warden_shell_quote() {
	printf "%s" "$1" | sed "s/'/'\\\\''/g; 1s/^/'/; \$s/\$/'/"
}

warden_shell_rc() {
	case "$1" in
	bash) printf '%s\n' "$HOME/.bashrc" ;;
	zsh)
		if [ -n "${ZDOTDIR:-}" ] && [ -d "$ZDOTDIR" ]; then
			printf '%s\n' "$ZDOTDIR/.zshrc"
		else
			printf '%s\n' "$HOME/.zshrc"
		fi
		;;
	fish) warden_fish_conf_d_path ;;
	*) return 1 ;;
	esac
}

warden_fish_config_dir() {
	if [ -n "${XDG_CONFIG_HOME:-}" ]; then
		printf '%s/fish\n' "$XDG_CONFIG_HOME"
	else printf '%s/.config/fish\n' "$HOME"; fi
}

warden_fish_conf_d_path() {
	printf '%s/conf.d/plugin-warden.fish\n' "$(warden_fish_config_dir)"
}

warden_fish_function_path() {
	printf '%s/functions/warden.fish\n' "$(warden_fish_config_dir)"
}

warden_shell_source_path() {
	case "$1" in
	bash) printf '%s\n' "$WARDEN_HOME/run-warden/shell/bash.sh" ;;
	zsh) printf '%s\n' "$WARDEN_HOME/run-warden/shell/zsh.sh" ;;
	fish) printf '%s\n' "$WARDEN_HOME/run-warden/shell/fish.fish" ;;
	*) return 1 ;;
	esac
}

warden_shell_block() {
	shell_name=$1
	source_path=$(warden_shell_source_path "$shell_name") || return 1
	quoted_home=$(warden_shell_quote "$WARDEN_HOME")
	quoted_source=$(warden_shell_quote "$source_path")
	printf '%s\n' "$WARDEN_SHELL_MARKER_BEGIN"
	case "$shell_name" in
	fish)
		printf 'set -gx WARDEN_HOME %s\n' "$quoted_home"
		printf 'source %s\n' "$quoted_source"
		;;
	bash | zsh)
		printf 'export WARDEN_HOME=%s\n' "$quoted_home"
		printf '. %s\n' "$quoted_source"
		;;
	*) return 1 ;;
	esac
	printf '%s\n' "$WARDEN_SHELL_MARKER_END"
}

warden_fish_quote() {
	printf "%s" "$1" | sed "s/'/\\\\'/g; 1s/^/'/; \$s/\$/'/"
}

warden_fish_conf_d_content() {
	quoted_home=$(warden_fish_quote "$WARDEN_HOME")
	cat <<EOF
# warden fish integration
set -gx WARDEN_HOME $quoted_home
source "\$WARDEN_HOME/run-warden/shell/fish.fish"
EOF
}

warden_fish_function_content() {
	cat <<'EOF'
# warden fish function
function warden --description "Run Warden"
    "$WARDEN_HOME/run-warden/bin/warden" $argv
end
EOF
}

warden_write_managed_file() {
	path=$1
	shift
	dir=${path%/*}
	mkdir -p "$dir"
	tmp_file="$path.warden-tmp"
	"$@" >"$tmp_file"
	if [ -f "$path" ]; then
		if cmp -s "$tmp_file" "$path"; then
			rm -f "$tmp_file"
			return 0
		fi
		if ! grep -F '# warden fish ' "$path" >/dev/null 2>&1; then
			rm -f "$tmp_file"
			warden_fail "refusing to overwrite existing unmanaged file: $path"
		fi
	fi
	mv "$tmp_file" "$path"
}

warden_shell_is_installed() {
	shell_name=$1
	case "$shell_name" in
	fish)
		conf_d=$(warden_fish_conf_d_path)
		function_file=$(warden_fish_function_path)
		[ -f "$conf_d" ] && [ -f "$function_file" ] && grep -F '# warden fish integration' "$conf_d" >/dev/null 2>&1 && grep -F '# warden fish function' "$function_file" >/dev/null 2>&1
		return $?
		;;
	esac
	rc_file=$(warden_shell_rc "$shell_name") || return 1
	[ -f "$rc_file" ] && grep -F "$WARDEN_SHELL_MARKER_BEGIN" "$rc_file" >/dev/null 2>&1 && grep -F "$WARDEN_SHELL_MARKER_END" "$rc_file" >/dev/null 2>&1
}

warden_shell_remove_one() {
	shell_name=$1
	case "$shell_name" in
	fish)
		conf_d=$(warden_fish_conf_d_path)
		function_file=$(warden_fish_function_path)
		for managed_file in "$conf_d" "$function_file"; do
			if [ -f "$managed_file" ] && grep -F '# warden fish ' "$managed_file" >/dev/null 2>&1; then
				rm -f "$managed_file"
			fi
		done
		old_rc="$HOME/.config/fish/config.fish"
		if [ -f "$old_rc" ]; then
			tmp_file="$old_rc.warden-tmp"
			sed "/^$WARDEN_SHELL_MARKER_BEGIN$/,/^$WARDEN_SHELL_MARKER_END$/d" "$old_rc" >"$tmp_file"
			mv "$tmp_file" "$old_rc"
		fi
		return 0
		;;
	esac
	rc_file=$(warden_shell_rc "$shell_name") || return 1
	[ -f "$rc_file" ] || return 0
	tmp_file="$rc_file.warden-tmp"
	sed "/^$WARDEN_SHELL_MARKER_BEGIN$/,/^$WARDEN_SHELL_MARKER_END$/d" "$rc_file" >"$tmp_file"
	mv "$tmp_file" "$rc_file"
}

warden_shell_install_one() {
	shell_name=$1
	case "$shell_name" in
	fish)
		conf_d=$(warden_fish_conf_d_path)
		function_file=$(warden_fish_function_path)
		if [ -e "$conf_d" ]; then
			printf 'already installed - fish -> %s\n' "$conf_d"
		else
			warden_write_managed_file "$conf_d" warden_fish_conf_d_content
			printf 'installed - fish -> %s\n' "$conf_d"
		fi
		if [ -e "$function_file" ]; then
			printf 'already installed - fish -> %s\n' "$function_file"
		else
			warden_write_managed_file "$function_file" warden_fish_function_content
			printf 'installed - fish -> %s\n' "$function_file"
		fi
		return 0
		;;
	esac
	rc_file=$(warden_shell_rc "$shell_name") || return 1
	if warden_shell_is_installed "$shell_name"; then
		printf 'already installed - %s -> %s\n' "$shell_name" "$rc_file"
		return 0
	fi
	rc_dir=${rc_file%/*}
	mkdir -p "$rc_dir"
	touch "$rc_file"
	{
		printf '\n'
		warden_shell_block "$shell_name"
	} >>"$rc_file"
	printf 'installed - %s -> %s\n' "$shell_name" "$rc_file"
}

warden_shell_status() {
	for shell_name in bash zsh fish; do
		rc_file=$(warden_shell_rc "$shell_name")
		if warden_shell_is_installed "$shell_name"; then
			printf 'ok - %s integration installed in %s\n' "$shell_name" "$rc_file"
		else
			printf 'not ok - %s integration missing in %s\n' "$shell_name" "$rc_file"
			printf 'manual: ./warden shell init %s\n' "$shell_name"
		fi
	done
}

warden_current_shell() {
	if [ -n "${WARDEN_CURRENT_SHELL:-}" ]; then
		shell_name=${WARDEN_CURRENT_SHELL##*/}
		case "$shell_name" in bash | zsh | fish)
			printf '%s\n' "$shell_name"
			return 0
			;;
		esac
	fi
	if command -v ps >/dev/null 2>&1; then
		current_pid=${PPID:-}
		while [ -n "$current_pid" ] && [ "$current_pid" -gt 1 ] 2>/dev/null; do
			ps_line=$(ps -p "$current_pid" -o ppid= -o comm= 2>/dev/null) || break
			parent_pid=$(printf '%s\n' "$ps_line" | awk '{print $1}')
			shell_name=$(printf '%s\n' "$ps_line" | awk '{print $2}')
			shell_name=${shell_name#-}
			shell_name=${shell_name##*/}
			case "$shell_name" in bash | zsh | fish)
				printf '%s\n' "$shell_name"
				return 0
				;;
			esac
			current_pid=$parent_pid
		done
	fi
	if [ -n "${SHELL:-}" ]; then
		shell_name=${SHELL##*/}
		case "$shell_name" in bash | zsh | fish)
			printf '%s\n' "$shell_name"
			return 0
			;;
		esac
	fi
	return 1
}

warden_shell_label() {
	case "$1" in
	bash) printf '%s\n' Bash ;;
	zsh) printf '%s\n' Zsh ;;
	fish) printf '%s\n' Fish ;;
	*) printf '%s\n' "$1" ;;
	esac
}

warden_shell_install_prompt_one() {
	shell_name=$1
	default=${2:-no}
	label=$(warden_shell_label "$shell_name")
	if warden_confirm "$label detected, do you want to install $shell_name integration?" "$default"; then
		warden_shell_install_one "$shell_name"
		return 0
	fi
	printf 'skipped - %s integration\n' "$shell_name"
	return 1
}

warden_shell_config_target() {
	case "$1" in
	bash) printf '%s\n' "$HOME/.bashrc" ;;
	zsh) warden_shell_rc zsh ;;
	fish) warden_fish_config_dir ;;
	*) return 1 ;;
	esac
}

warden_shell_config_exists() {
	case "$1" in
	bash) [ -f "$HOME/.bashrc" ] ;;
	zsh)
		rc_file=$(warden_shell_rc zsh) || return 1
		[ -f "$rc_file" ]
		;;
	fish) [ -d "$(warden_fish_config_dir)" ] ;;
	*) return 1 ;;
	esac
}

warden_shell_install() {
	printf '%s\n' "Warden can add reversible guarded blocks to bash/zsh startup files and managed fish files."
	printf '%s\n' "Remove later with: warden shell remove"
	installed=0
	current_shell=$(warden_current_shell || true)
	if [ -n "$current_shell" ]; then
		warden_shell_install_prompt_one "$current_shell" yes && installed=1
	else
		printf '%s\n' "Current shell not detected; defaulting all prompts to no."
	fi
	for shell_name in bash zsh fish; do
		[ "$shell_name" = "$current_shell" ] && continue
		if ! warden_shell_config_exists "$shell_name"; then
			config_target=$(warden_shell_config_target "$shell_name")
			printf 'skipped - %s shell environment not detected (%s missing)\n' "$shell_name" "$config_target"
			continue
		fi
		if warden_confirm "Install $shell_name integration too?" no; then
			warden_shell_install_one "$shell_name"
			installed=1
		else
			printf 'skipped - %s integration\n' "$shell_name"
		fi
	done
	if [ "$installed" -eq 0 ]; then
		printf '%s\n' "shell integration declined. Manual snippets: ./warden shell init bash|zsh|fish"
	fi
}

warden_shell_remove() {
	for shell_name in bash zsh fish; do
		warden_shell_remove_one "$shell_name"
		printf 'removed - %s\n' "$shell_name"
	done
}

warden_shell_init() {
	shell_name=$1
	case "$shell_name" in
	bash | zsh | fish) ;;
	*)
		printf '%s\n' "usage: warden shell init bash|zsh|fish" >&2
		return 2
		;;
	esac
	case "$shell_name" in
	fish)
		printf '# %s\n' "$(warden_fish_conf_d_path)"
		warden_fish_conf_d_content
		printf '\n# %s\n' "$(warden_fish_function_path)"
		warden_fish_function_content
		;;
	*) warden_shell_block "$shell_name" ;;
	esac
}
