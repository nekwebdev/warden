# warden-flow

`@nekwebdev/warden-flow` is Warden's Pi Agent workflow, durable-orientation, and commit-safety package.

It reduces repeated repo discovery by maintaining a small map tree, injecting only token-conscious capsules when relevant, and providing lean workflow skills plus safe local commit planning tools.

## What it provides

- `/skill:warden-map` — creates or refreshes repository map files; leading `--auto` uses one safe cleaned scope and skips optional prompt mechanics without bypassing dirty-repo refusal.
- `/skill:warden-docs` — aligns stale `README.md` and `AGENTS.md` files with repo evidence when map freshness is current.
- `/skill:warden-create-skill` — creates a new global or project Agent Skill from the bundled Warden skill template.
- `/skill:warden-start` — turns rough intent into one small `.warden/work/<slug>/packet.md` work packet for a lean dev cycle.
- `/skill:warden-grill` — pressure-tests a work packet or manual feedback through a question/update loop until it is solid for TDD.
- `/skill:warden-tdd` — implements one grilled work packet slice with strict test-first workflow.
- `/skill:warden-close` — validates an accepted work packet or existing closure `handoff.md`, creates or updates final `handoff.md`, and decides changelog/map impact.
- `warden_branch_close` — extension tool that closes accepted feature-branch work only from structured post-close handoff arguments and exact package-generated consent markers.
- `/skill:warden-commit` — plans safe, atomic local commits and can apply them after plan approval; leading `--auto` may create local commits without a second approval only after strict snapshot safety checks and package-generated consent.
- `/warden:effort` — opens the Warden panel Effort pane for Warden skill thinking-level settings through `@nekwebdev/warden-panel`.
- `extensions/warden-map` — injects map capsules and git context.
- `extensions/warden-commit` — registers `warden_commit_snapshot` and `warden_commit_apply` for safe local commit planning and execution.
- `extensions/warden-effort` — seeds Warden skill effort defaults and applies configured effort before `/skill:warden-*` expansion.
- `extensions/warden-packet-tracker` — records allowlisted Warden Flow packet lifecycle state in `.warden/work/packet-tracker.json` after completed skill turns and publishes the active packet in the Pi footer.
- `extensions/warden-tmux-question-alert` — when `ask_user_question` waits for user input, flashes the Warden tmux robot prefix between `󱚤` and `󱚥` and sends a Linux desktop notification with the agent name and question text.
- Session-start map injection — hidden root map capsule from `<git-root>/.warden/map.md`.
- Scoped map injection — hidden scoped capsules from `<git-root>/.warden/maps/<scope>/map.md` appended to relevant tool results.
- Git context injection — branch, short commit, and dirty state.

## Map layout

When cwd is inside a Git repository, maps are canonical at the Git top-level, even when Pi runs from a nested cwd:

```text
<git-root>/.warden/
├── map.md
├── map-state.json
└── maps/
    └── <repo-relative-scope>/
        └── map.md
```

Examples:

```text
.warden/map.md
.warden/map-state.json
.warden/maps/pi-warden/map.md
.warden/maps/pi-warden/warden-flow/map.md
```

Only `/skill:warden-map` writes maps and `.warden/map-state.json`. It refuses dirty Git repositories before refreshing either. The marker is rooted at the Git top-level `.warden/**`, not at nested package cwd paths.

## Capsule contract

Only marked capsules are auto-injected:

```md
<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->
```

The extension prepends freshness metadata from `.warden/map-state.json` to each injected root or scoped capsule:

```text
Freshness: fresh|stale|unknown
Map basis: <short-sha|unknown>
Current HEAD: <short-sha|unknown>
```

Freshness uses the requested map's basis SHA. Same basis and current Git HEAD is fresh; otherwise the committed diff from basis to current HEAD is fresh only when it touches map-owned paths (`.warden/map.md`, `.warden/maps/**/map.md`, or `.warden/map-state.json`). Dirty working-tree state remains separate Git context.

Full map bodies stay on disk. Agents can read them explicitly when a task needs deeper context.

## Token budget

Approximate budget rule: 1 KB markdown is about 250–350 tokens.

| Context | Target | Hard cap |
|---|---:|---:|
| Root capsule | 3 KB (~900 tokens) | 8 KB (~2,400 tokens) |
| Scoped capsule | 1.5 KB (~450 tokens) | 4 KB (~1,200 tokens) |
| One scoped injection event | — | 6 KB (~1,800 tokens) |
| Session start total | — | 10 KB (~3,000 tokens) |

When a capsule is missing or too large, the extension injects a small notice pointing at the map file instead of injecting the full file.

## Git context

When git is available, the extension injects:

```md
## Current Git Context
- Branch: main
- Commit: abc1234
- Dirty: yes — staged 1, unstaged 3, untracked 2
- Dirty paths: src/a.ts, docs/b.md
```

Git context is cached and re-injected only when branch, commit, or dirty state changes.

## Runtime directives

`extensions/warden-directives` can inject invocation-scoped Warden Flow guidance before a skill turn. Current support covers `warden-start` prompt selection, leading name/branch flags, `warden-start` auto mode, plus explicit leading `--auto` for `warden-commit` and `warden-map`.

Use leading flags to make `warden-start` packet selection deterministic before drafting:

```text
/skill:warden-start --name tiny-change add a tiny change
/skill:warden-start --branch chore/tiny-change add a tiny change
/skill:warden-start --auto --branch chore/tiny-change add a tiny change
```

`--name <slug>`, `--branch <type>/<slug>`, and `--auto` are control syntax only when they appear before rough intent. The skill receives cleaned user intent such as `add a tiny change`, plus hidden package-computed selection metadata. Slugs use lowercase letters, numbers, and single dashes only; no slashes.

`--auto` skips optional fine-tuning prompts when safe. If no current branch context already handles branch choice, auto mode verifies `git status --porcelain` is clean, then runs only local `git switch <type>/<slug>` for an existing branch or `git switch -c <type>/<slug>` for a new branch.

You can also set a Pi agent fallback in `settings.json`:

```json
{
  "warden": {
    "flow": {
      "interactionMode": "auto"
    }
  }
}
```

Precedence for `warden-start` is explicit invocation flag, then `warden.flow.interactionMode`, then normal interactive behavior. `warden-commit` and `warden-map` do not use settings fallback auto mode; they require direct leading `--auto` or a future stricter package-generated handoff. Unsupported modes or missing directive files fail safe by stripping explicit `--auto` when applicable and injecting no directive. This slice has no per-invocation `--interactive` escape flag for `warden-start`; disable or change the setting to restore plain interactive default behavior.

Explicit auto examples:

```text
/skill:warden-map --auto pi-warden/warden-flow
/skill:warden-commit --auto package-local auto-mode slice
```

`warden-map --auto` accepts only empty/root scope or one safe repo-relative scope before directive injection. It rejects absolute paths, `..` escapes, empty path segments, shell metacharacters, and ambiguous multi-token scope text. The map workflow still refuses dirty repositories before map or map-state writes.

`warden-commit --auto` injects a hidden package-generated `directAutoCommitConsent=true` marker. It may create local commits without a second approval only after `warden_commit_snapshot` and inspection show one clear user intent and one cohesive commit plan. Snapshot buckets may be merged when they are companion parts of the same change, such as package implementation, tests, docs, skill guidance, and required root changelog updates. It still rejects risky, excluded, hidden, generated, secret-looking, unrelated, warning, staged/unstaged ambiguity, or unclear grouping paths, and it must apply only through `warden_commit_apply`. It performs no remote or destructive Git operations.

Runtime directives stay inside the `@nekwebdev/warden-flow` package. They do not implement runner workflows, agent lifecycle commands, Pi launch plumbing, worktree creation, remote setup, fetch, pull, push, or sibling package behavior.

## Tmux question alert

`extensions/warden-tmux-question-alert` listens for the public `rpiv:ask-user:prompt` event emitted by `@juicesharp/rpiv-ask-user-question`. If Pi is running under tmux and the Pi pane's window name starts with Warden's robot prefix (`󱚤`), it targets `$TMUX_PANE` and alternates that prefix with `󱚥` until the `ask_user_question` tool returns, the agent turn ends, or the session shuts down. It restores the captured base window name afterward and ignores missing, unavailable, or failing tmux commands.

At the same prompt event, the extension best-effort runs `notify-send` with title `Question ready from <agent>` and the question text as the notification body. If `notify-send` is missing or fails, it falls back to `dms notify` with the same title/body arguments. The agent name resolves from `WARDEN_AGENT_NAME` when present, then `$PI_CODING_AGENT_DIR`'s basename. Missing or failing notification commands are ignored.

The extension only changes Warden-prefixed tmux windows, so local `pi -e ./pi-warden/warden-flow` runs outside `warden pi NAME ...` are left alone unless the window already uses the Warden robot prefix. Desktop notifications can still run outside tmux when an agent name is available.

## Packet tracker

`extensions/warden-packet-tracker` observes completed allowlisted Warden Flow skill turns and writes tracker state at the Git repository root:

```text
<git-root>/.warden/work/packet-tracker.json
```

The path is always rooted at `git rev-parse --show-toplevel` when cwd is nested inside a repository. It is never rooted at a nested package cwd.

Tracker schema is versioned:

```json
{
  "version": 1,
  "current": null,
  "queue": [],
  "recentCompleted": []
}
```

`current` and `queue` entries contain exactly. `packetPath` is always the full repo-relative packet path. `packetName` is display text from the final skill output `Packet name:` tracker field with a packet-path fallback, and is not validated against the path:

```json
{
  "packetPath": ".warden/work/example/packet.md",
  "packetName": "example",
  "lastStep": "warden-tdd",
  "lastStatus": "success",
  "lastSummary": "green",
  "nextStep": "warden-close",
  "timestamp": "2026-06-10T12:00:00.000Z"
}
```

Completed entries in `recentCompleted` add `handoffPath`. `recentCompleted` keeps the latest 5 closures. Allowed steps are `warden-start`, `warden-grill`, `warden-tdd`, and `warden-close`. Allowed statuses are `success`, `failure`, and `aborted`. Allowed next steps are those steps plus `done`.

Lifecycle behavior is deterministic:

- successful `warden-start` sets `current`, moves any old current to the front of `queue`, and sets `nextStep: "warden-grill"`;
- successful `warden-grill` sets `nextStep: "warden-tdd"`;
- successful `warden-tdd` asks through extension UI whether the next step is another `warden-grill` loop or `warden-close`; if UI is unavailable or dismissed, it falls back to `warden-grill`;
- successful `warden-close` requires sibling `handoff.md`, moves the packet to `recentCompleted`, trims to 5, and promotes the queue front;
- successful `warden-close` without `handoff.md` records tracker failure and keeps `nextStep: "warden-close"`;
- failed or aborted steps update the matching packet for retry without advancing the deterministic flow.

The extension captures allowlisted invocations from raw `input` or expanded `before_agent_start` skill prompts, then processes final assistant messages at `agent_end`. It parses `Packet name:`, `Packet path:`, `Tracker status:`, and `Summary:` only from the top tracker block before the first `##` heading, while keeping `nextStep` extension-owned. Existing malformed or schema-invalid tracker JSON is left unchanged for that update.

When `warden.flow.showActiveFlowStatus` is absent or `true`, the extension sets Pi footer status key `warden-flow.active-flow` to `Active Flow: <packetName> - next: <nextStep>` using `current.packetName` and `current.nextStep`. Missing, malformed, schema-invalid, or `current: null` tracker state renders `Active Flow: none` without rewriting tracker JSON. Set `warden.flow.showActiveFlowStatus` to `false` from the Display pane to clear the footer status immediately and keep it cleared on later refreshes.

## Skill effort

Warden Flow stores per-skill effort settings and the skill status indicator toggle in Pi `settings.json`:

```json
{
  "warden": {
    "effort": {
      "showSkillStatus": true,
      "skills": {
        "warden-map": "low",
        "warden-start": "medium",
        "warden-grill": "high",
        "warden-tdd": "high",
        "warden-close": "medium",
        "warden-commit": "medium",
        "warden-create-skill": "high",
        "warden-docs": "medium"
      }
    }
  }
}
```

Current defaults seeded at session start:

- `warden-map`: `low`
- `warden-start`: `medium`
- `warden-grill`: `high`
- `warden-tdd`: `high`
- `warden-close`: `medium`
- `warden-commit`: `medium`
- `warden-create-skill`: `high`
- `warden-docs`: `medium`

`/warden:effort` opens the Effort pane contributed through the public pane API from `@nekwebdev/warden-panel`. `warden-flow` declares that package as a dependency so the pane framework is available when the Effort extension loads. Space/Enter cycles a selected skill through `off`, `minimal`, `low`, `medium`, `high`, `xhigh` and writes immediately; there is no Apply step.

`extensions/warden-effort` also contributes a Display pane setting for the skill status indicator through `contributeWardenDisplaySetting()`. The indicator defaults on. Toggle it from Display; the setting writes inline.

When a `/skill:warden-*` turn starts, `extensions/warden-effort` reads the configured level, calls Pi's public `setThinkingLevel()`, shows a small themed Pi status indicator with the active skill and effort level unless `warden.effort.showSkillStatus` is explicitly `false`, then restores the previous thinking level and clears the status indicator after the agent turn. Pi may clamp unsupported levels depending on the active model/provider.

## Create skill workflow

`/skill:warden-create-skill` creates a new Agent Skill under either `$PI_CODING_AGENT_DIR/.agents/skills/<skill-name>/SKILL.md` for global use by the current Pi agent environment, or `<git-root>/.agents/skills/<skill-name>/SKILL.md` for project use.

It asks the user to choose global or project scope, reads `skills/warden-create-skill/templates/SKILL-template.md`, strips template-only guidance, and writes only the new skill's final `SKILL.md`. It refuses silent overwrites.

## Close workflow

`/skill:warden-close` accepts a `packet.md` or `handoff.md` path. It validates accepted closure against packet/repo evidence, creates a missing sibling `handoff.md` when closure evidence is sufficient, leaves valid handoffs unchanged, and may update stale handoff content. It does not implement code, edit maps, stage changes, or commit changes.

Successful close output includes deterministic map-impact tracker fields: `Maps: none | scoped-refresh | root-refresh` and `Maps scope: none | <repo-relative-scope> | root`. The packet tracker parses those fields from the final assistant output only; it does not persist them in `.warden/work/packet-tracker.json`.

After a successful close on a safe non-default feature branch, the packet tracker can ask whether to hand off to `warden_branch_close`. Accepting dispatches or queues only structured arguments: feature branch, detected default branch, parsed map fields, packet path/name, current worktree path, and the package-generated `branchCloseDestructiveConsent: true` plus `branchCloseAutoCommitConsent: true` markers. If the prompt UI is unavailable/dismissed or no branch-close dispatcher is registered, no git mutation starts and the extension exposes a manual `warden_branch_close` next step. Default-branch, detached-HEAD, declined, missing-map-field, and unsafe-branch-name paths do not start branch close.

Use it when accepted work needs final closure documented, or when an existing close record should be confirmed before commit planning.

## Branch close tool

`warden_branch_close` validates structured handoff arguments before planning any mutating command. It rejects unsafe branch names, invalid map field pairs, detached HEAD, default-branch runs, missing destructive consent, ambiguous dirty state, risky/hidden/generated/secret-looking dirty paths, unsafe auto-commit snapshots, missing default worktrees, default-branch divergence, and git failures.

Dirty eligible packet work can be auto-committed only when both exact markers are present: `branchCloseDestructiveConsent: true` and `branchCloseAutoCommitConsent: true`. The tool uses the same snapshot/apply safety contract as `warden_commit_snapshot` and `warden_commit_apply`; otherwise it stops with `/skill:warden-commit --auto ...` or `/skill:warden-commit ...` as the next safe command. Missing auto-commit consent does not block a proven clean no-op close.

When maps require refresh, the tool stops before `git fetch origin`, rebase, merge, push, or cleanup. Root refresh returns `/skill:warden-map --auto`; scoped refresh returns `/skill:warden-map --auto <scope>`; then commit safe map changes and rerun `warden_branch_close` with the same structured arguments.

After commit/no-op and map checks pass, the command order is fetch origin, fast-forward-sync the default worktree when present, rebase the feature branch onto `origin/<default>`, merge to default with `git merge --no-ff --no-edit <feature>`, push default, then clean up only after successful push. Multi-worktree cleanup runs from the default worktree cwd: remove feature worktree, delete local feature branch, then delete remote feature branch. If current feature worktree is removed, output includes `current worktree removed; close this worktree pi agent`. If cleanup fails after push, status is `partial_success` with the remaining manual cleanup command.

Result states are `closed`, `needs_map_refresh`, `blocked`, and `partial_success`.

## Commit helper

`/skill:warden-commit` uses `warden_commit_snapshot` from `extensions/warden-commit` to plan local commits without token-heavy repeated git inspection.

`warden_commit_snapshot` is read-only. It reports compact git status, Warden boundaries, path risks, deterministic buckets, recent commit subjects, and a stable snapshot hash. It does not stage, commit, push, pull, fetch, rebase, reset, amend, tag, or create PRs.

`warden_commit_apply` is intended to run only after the user approves an explicit plan. Tool input assumes that approval already happened, so it does not include a separate confirmation field. It recomputes the snapshot, refuses when the hash changed, validates exact repo-relative paths, rejects risky/excluded paths by default, refuses mixed staged/unstaged changes, allows pre-existing staged renames only when their destination paths are included in the first planned commit, stages only exact paths, verifies the staged set before `git commit`, and returns commit hashes plus final `git status --short`.

It never pushes, pulls, fetches, rebases, resets, amends, tags, stashes, checks out, cleans, restores, creates PRs, or runs remote git operations.

## Package dependency

`warden-flow` depends on `@nekwebdev/warden-panel` for the Effort pane registry and panel opener used by `/warden:effort`. In this repository the dependency is declared as `file:../warden-panel` so local package development and Pi local installs resolve the sibling package explicitly.

## Scope boundary

This package owns Warden workflow/orientation Pi behavior, including `warden-map`, `warden-docs`, `warden-create-skill`, `warden-start`, `warden-grill`, `warden-tdd`, `warden-close`, `warden-commit`, `warden_branch_close`, map capsule injection, commit snapshot/apply tooling, and Warden Flow skill effort settings.

It does not own Warden runner workflows, Pi agent lifecycle commands, or sibling package installation workflows.

## Local development

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```

From the Warden repo root, load temporarily during development:

```sh
pi -e ./pi-warden/warden-flow
```

Or install locally into a Pi environment:

```sh
pi install ./pi-warden/warden-flow
```
