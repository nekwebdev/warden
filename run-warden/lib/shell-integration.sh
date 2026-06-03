WARDEN_SHELL_MARKER_BEGIN="# warden begin"
WARDEN_SHELL_MARKER_END="# warden end"

warden_confirm() {
	prompt=$1
	if [ "${WARDEN_YES:-}" = "1" ]; then return 0; fi
	if [ ! -t 0 ]; then return 1; fi
	printf '%s [y/N] ' "$prompt" >&2
	read -r answer
	case "$answer" in y | Y | yes | YES) return 0 ;; *) return 1 ;; esac
}

warden_shell_quote() {
	printf "%s" "$1" | sed "s/'/'\\\\''/g; 1s/^/'/; \$s/\$/'/"
}

warden_shell_rc() {
	case "$1" in
	bash) printf '%s\n' "$HOME/.bashrc" ;;
	zsh) printf '%s\n' "$HOME/.zshrc" ;;
	fish) printf '%s\n' "$HOME/.config/fish/config.fish" ;;
	*) return 1 ;;
	esac
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

warden_shell_is_installed() {
	rc_file=$(warden_shell_rc "$1") || return 1
	[ -f "$rc_file" ] && grep -F "$WARDEN_SHELL_MARKER_BEGIN" "$rc_file" >/dev/null 2>&1
}

warden_shell_remove_one() {
	shell_name=$1
	rc_file=$(warden_shell_rc "$shell_name") || return 1
	[ -f "$rc_file" ] || return 0
	tmp_file="$rc_file.warden-tmp"
	sed "/^$WARDEN_SHELL_MARKER_BEGIN$/,/^$WARDEN_SHELL_MARKER_END$/d" "$rc_file" >"$tmp_file"
	mv "$tmp_file" "$rc_file"
}

warden_shell_install_one() {
	shell_name=$1
	rc_file=$(warden_shell_rc "$shell_name") || return 1
	rc_dir=${rc_file%/*}
	mkdir -p "$rc_dir"
	touch "$rc_file"
	warden_shell_remove_one "$shell_name"
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
			printf 'manual: ./warden shell snippet %s\n' "$shell_name"
		fi
	done
}

warden_shell_install() {
	printf '%s\n' "Warden can add reversible guarded blocks to bash, zsh, and fish startup files."
	printf '%s\n' "Remove later with: ./warden shell remove"
	if ! warden_confirm "Install shell integration blocks?"; then
		printf '%s\n' "shell integration declined. Manual snippets: ./warden shell snippet bash|zsh|fish"
		return 0
	fi
	for shell_name in bash zsh fish; do warden_shell_install_one "$shell_name"; done
}

warden_shell_remove() {
	for shell_name in bash zsh fish; do
		warden_shell_remove_one "$shell_name"
		printf 'removed - %s\n' "$shell_name"
	done
}

warden_shell_snippet() {
	shell_name=$1
	if [ -z "$shell_name" ]; then
		printf '%s\n' "usage: run-warden shell snippet bash|zsh|fish" >&2
		return 2
	fi
	warden_shell_block "$shell_name"
}
