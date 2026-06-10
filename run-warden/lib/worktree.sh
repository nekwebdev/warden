warden_worktree_usage() {
	printf '%s\n' "usage: warden worktree AGENT" >&2
}

warden_worktree_is_number() {
	case "${1:-}" in
	"" | *[!0123456789]*) return 1 ;;
	*) return 0 ;;
	esac
}

warden_worktree_parse_list() {
	porcelain_file=$1
	entries_file=$2
	wt_path=
	wt_branch=

	warden_worktree_flush_entry() {
		if [ -z "$wt_path" ]; then
			wt_branch=
			return 0
		fi
		if [ -n "$wt_branch" ]; then
			wt_label=$wt_branch
		else
			wt_label="(detached)"
		fi
		printf '%s\n%s\n' "$wt_label" "$wt_path" >>"$entries_file"
		wt_path=
		wt_branch=
	}

	while IFS= read -r wt_line || [ -n "$wt_line" ]; do
		case "$wt_line" in
		"")
			warden_worktree_flush_entry
			;;
		worktree\ *)
			wt_path=${wt_line#worktree }
			;;
		branch\ refs/heads/*)
			wt_branch=${wt_line#branch refs/heads/}
			;;
		branch\ *)
			wt_branch=${wt_line#branch }
			;;
		esac
	done <"$porcelain_file"
	warden_worktree_flush_entry
}

warden_worktree_entry_count() {
	entries_file=$1
	line_count=$(wc -l <"$entries_file" | tr -d ' ')
	printf '%s\n' $((line_count / 2))
}

warden_worktree_print_menu() {
	entries_file=$1
	resolved_cwd=$2
	index=0
	while IFS= read -r wt_label && IFS= read -r wt_path; do
		index=$((index + 1))
		printf '%s) %s - %s\n' "$index" "$wt_label" "$wt_path"
	done <"$entries_file"
	printf '%s) create new worktree for %s\n' "$((index + 1))" "${resolved_cwd##*/}"
}

warden_worktree_selected_path() {
	entries_file=$1
	choice=$2
	index=0
	while IFS= read -r wt_label && IFS= read -r wt_path; do
		index=$((index + 1))
		if [ "$index" -eq "$choice" ]; then
			printf '%s\n' "$wt_path"
			return 0
		fi
	done <"$entries_file"
	return 1
}

warden_worktree_read_choice() {
	if ! IFS= read -r worktree_choice; then
		printf '%s\n' "warden: unexpected EOF reading worktree choice" >&2
		return 2
	fi
	warden_worktree_is_number "$worktree_choice" || {
		printf '%s\n' "warden: invalid worktree choice: $worktree_choice" >&2
		return 2
	}
	printf '%s\n' "$worktree_choice"
}

warden_worktree_read_name() {
	printf '%s\n' "Type new worktree folder name, using lowercase letters, numbers, and single hyphens; no spaces. Example: issue-123-fix" >&2
	if ! IFS= read -r worktree_name; then
		printf '%s\n' "warden: unexpected EOF reading worktree name" >&2
		return 2
	fi
	if ! printf '%s\n' "$worktree_name" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$'; then
		printf '%s\n' "warden: invalid worktree name: $worktree_name" >&2
		printf '%s\n' "Use lowercase letters, numbers, and single hyphens; no spaces, slashes, underscores, uppercase, leading hyphens, trailing hyphens, or repeated hyphens. Example: issue-123-fix" >&2
		printf '%s\n' "Worktree names must match ^[a-z0-9]+(-[a-z0-9]+)*$" >&2
		return 2
	fi
	printf '%s\n' "$worktree_name"
}

warden_worktree_read_type() {
	printf '%s\n' "Choose branch type for the new worktree:" >&2
	printf '%s\n' "1) feature" >&2
	printf '%s\n' "2) bugfix" >&2
	printf '%s\n' "3) hotfix" >&2
	printf '%s\n' "4) release" >&2
	printf '%s\n' "5) docs" >&2
	printf '%s\n' "6) test" >&2
	printf '%s\n' "7) chore" >&2
	if ! IFS= read -r worktree_type_choice; then
		printf '%s\n' "warden: unexpected EOF reading worktree type" >&2
		return 2
	fi
	case "$worktree_type_choice" in
	1) printf '%s\n' feature ;;
	2) printf '%s\n' bugfix ;;
	3) printf '%s\n' hotfix ;;
	4) printf '%s\n' release ;;
	5) printf '%s\n' docs ;;
	6) printf '%s\n' test ;;
	7) printf '%s\n' chore ;;
	*)
		printf '%s\n' "warden: invalid worktree type: $worktree_type_choice" >&2
		return 2
		;;
	esac
}

warden_worktree_read_origin_url() {
	printf '%s\n' "No Git remote named origin is configured." >&2
	printf '%s\n' "Git URL for origin (examples: git@github.com:owner/repo.git, https://github.com/owner/repo.git, /path/to/repo.git):" >&2
	if ! IFS= read -r origin_url; then
		printf '%s\n' "warden: unexpected EOF reading origin URL" >&2
		return 2
	fi
	if [ -z "$origin_url" ]; then
		printf '%s\n' "warden: origin URL is required" >&2
		return 2
	fi
	printf '%s\n' "$origin_url"
}

warden_worktree_ensure_origin() {
	repo_root=$1
	if git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
		return 0
	fi
	origin_url=$(warden_worktree_read_origin_url) || return $?
	git -C "$repo_root" remote add origin "$origin_url" || {
		printf '%s\n' "warden: failed to add origin remote: $origin_url" >&2
		return 1
	}
}

warden_worktree_fetch_origin_main() {
	repo_root=$1
	if ! git -C "$repo_root" fetch origin main:refs/remotes/origin/main; then
		printf '%s\n' "warden: failed to fetch origin/main from origin" >&2
		return 1
	fi
	if ! git -C "$repo_root" rev-parse --verify --quiet refs/remotes/origin/main >/dev/null; then
		printf '%s\n' "warden: missing origin/main after fetch" >&2
		return 2
	fi
}

warden_worktree_check_remote_branch_absent() {
	repo_root=$1
	branch=$2
	if git -C "$repo_root" ls-remote --exit-code origin "refs/heads/$branch" >/dev/null 2>&1; then
		printf '%s\n' "warden: remote branch already exists: origin/$branch" >&2
		return 2
	else
		ls_remote_status=$?
	fi
	if [ "$ls_remote_status" -eq 2 ]; then
		return 0
	fi
	printf '%s\n' "warden: failed to check remote branch collision: origin/$branch" >&2
	return 1
}

warden_worktree_create_new() {
	name=$1
	agent_dir=$2
	repo_root=$3
	worktree_name=$(warden_worktree_read_name) || return $?
	worktree_type=$(warden_worktree_read_type) || return $?
	branch=$worktree_type/$worktree_name
	worktree_parent=$agent_dir/worktree
	worktree_path=$worktree_parent/$worktree_name

	if [ -e "$worktree_path" ]; then
		printf '%s\n' "warden: worktree target already exists: $worktree_path" >&2
		return 2
	fi
	if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
		printf '%s\n' "warden: local branch already exists: $branch" >&2
		return 2
	fi
	warden_worktree_ensure_origin "$repo_root" || return $?
	warden_worktree_fetch_origin_main "$repo_root" || return $?
	warden_worktree_check_remote_branch_absent "$repo_root" "$branch" || return $?

	mkdir -p "$worktree_parent" || return 1
	if ! git -C "$repo_root" worktree add --no-track -b "$branch" "$worktree_path" origin/main; then
		printf '%s\n' "warden: failed to create worktree: $worktree_path" >&2
		return 1
	fi
	if ! git -C "$worktree_path" push -u origin "$branch"; then
		printf '%s\n' "warden: failed to push new worktree branch: $branch" >&2
		return 1
	fi

	printf 'created worktree: %s\n' "$worktree_path"
	printf 'created branch: %s\n' "$branch"
	warden_pi_launch_existing_agent "$name" "$agent_dir" "$worktree_path" || {
		launch_status=$?
		printf '%s\n' "warden: worktree creation succeeded, but Pi launch failed for agent '$name'" >&2
		return "$launch_status"
	}
}

warden_worktree() {
	if [ $# -ne 1 ]; then
		warden_worktree_usage
		return 2
	fi
	name=$1

	agent_dir=$(warden_agent_require_existing_dir "$name") || return $?
	settings_path=$(warden_agent_settings_path "$agent_dir")
	configured_cwd=$(warden_agent_settings_get_cwd "$settings_path" "$name") || return 1
	if [ -z "$configured_cwd" ]; then
		printf '%s\n' "warden: configured cwd is required for agent '$name'" >&2
		return 2
	fi
	resolved_cwd=$(warden_agent_resolve_configured_cwd "$name" "$configured_cwd") || return $?
	if ! git -C "$resolved_cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		printf '%s\n' "warden: configured cwd is not a Git worktree or repository for agent '$name': $resolved_cwd" >&2
		return 2
	fi
	repo_root=$(git -C "$resolved_cwd" rev-parse --show-toplevel) || {
		printf '%s\n' "warden: failed to resolve Git repository root for agent '$name': $resolved_cwd" >&2
		return 1
	}

	worktree_tmp_dir=${TMPDIR:-/tmp}
	porcelain_file=$(mktemp "$worktree_tmp_dir/warden-worktree-porcelain.XXXXXX") || return 1
	entries_file=$(mktemp "$worktree_tmp_dir/warden-worktree-entries.XXXXXX") || {
		rm -f "$porcelain_file"
		return 1
	}

	if ! git -C "$repo_root" worktree list --porcelain >"$porcelain_file"; then
		rm -f "$porcelain_file" "$entries_file"
		printf '%s\n' "warden: failed to list Git worktrees for agent '$name': $resolved_cwd" >&2
		return 1
	fi
	warden_worktree_parse_list "$porcelain_file" "$entries_file"
	worktree_count=$(warden_worktree_entry_count "$entries_file")
	if [ "$worktree_count" -eq 0 ]; then
		rm -f "$porcelain_file" "$entries_file"
		printf '%s\n' "warden: no Git worktrees found for agent '$name': $resolved_cwd" >&2
		return 1
	fi

	warden_worktree_print_menu "$entries_file" "$resolved_cwd"
	worktree_choice=$(warden_worktree_read_choice) || {
		status=$?
		rm -f "$porcelain_file" "$entries_file"
		return "$status"
	}
	new_choice=$((worktree_count + 1))
	if [ "$worktree_choice" -ge 1 ] && [ "$worktree_choice" -le "$worktree_count" ]; then
		selected_path=$(warden_worktree_selected_path "$entries_file" "$worktree_choice") || {
			rm -f "$porcelain_file" "$entries_file"
			printf '%s\n' "warden: invalid worktree choice: $worktree_choice" >&2
			return 2
		}
		rm -f "$porcelain_file" "$entries_file"
		warden_pi_launch_existing_agent "$name" "$agent_dir" "$selected_path"
		return $?
	fi
	if [ "$worktree_choice" -eq "$new_choice" ]; then
		rm -f "$porcelain_file" "$entries_file"
		warden_worktree_create_new "$name" "$agent_dir" "$repo_root"
		return $?
	fi

	rm -f "$porcelain_file" "$entries_file"
	printf '%s\n' "warden: invalid worktree choice: $worktree_choice" >&2
	return 2
}
