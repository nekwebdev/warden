# Warden Map Auto Mode

Auto mode changes only optional prompt mechanics for this `warden-map` invocation. Use the cleaned scope from the invocation and do not ask optional scope or refresh-style prompts when repo evidence is sufficient.

The extension accepts only empty/root scope or one safe repo-relative scope before this directive is injected. Absolute paths, `..` escapes, empty path segments, shell metacharacters, and ambiguous multi-token scope text are unsafe and must not reach map writes.

Safety cannot be bypassed. Discover the Git root, resolve the requested root or repo-relative scope under that Git root, then run `git status --porcelain` from the Git root before writing maps or `.warden/map-state.json`. If the repository is dirty, stop clearly without editing maps or map-state and tell the user to commit, stash, or otherwise clean the repo before rerunning `/skill:warden-map`.

Preserve existing map ownership rules: write only under Git root `.warden/**`, keep exactly one injection marker pair, preserve useful manual notes unless replacement is approved, keep maps orientation-only, and update `.warden/map-state.json` only after a successful clean map run.
