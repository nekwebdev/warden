# fresh-skill

`@nekwebdev/fresh-skill` is a standalone Pi extension package that adds `/fresh`.

`/fresh <skill> [args...]` starts a clean replacement Pi session, then sends the selected skill as a normal skill command in that new session:

```text
/fresh warden-start implement new extension
```

replays as:

```text
/skill:warden-start implement new extension
```

Old session/history is preserved by Pi session replacement. `fresh-skill` does not edit, delete, compact, or filter old session JSONL/history.

## Install or load

From Warden repo root during development:

```sh
pi -e ./pi-warden/fresh-skill
```

Install into a Pi environment:

```sh
pi install ./pi-warden/fresh-skill
```

## Usage

Use bare skill names:

```text
/fresh warden-start implement new extension
```

A manual `skill:` prefix is accepted and normalized:

```text
/fresh skill:warden-start implement new extension
```

Both forms validate loaded skill `warden-start` and replay `/skill:warden-start implement new extension` from replacement session context.

Parsing uses first whitespace-delimited token as skill name. Remaining text after that token is preserved exactly when replaying.

## Autocomplete

`/fresh` autocomplete reads `pi.getCommands()`, keeps only entries where `source === "skill"`, strips `skill:` from displayed/inserted names, fuzzy-filters bare skill names using Pi TUI matching, and reuses command descriptions.

It accepts fuzzy input with or without `skill:`:

```text
/fresh comm
/fresh skill:comm
```

Both can complete to `warden-commit`. Autocomplete excludes prompt templates, extension commands, built-ins, and all non-skill commands.

After a skill token and following whitespace are entered, `/fresh` returns no command-specific completions so Pi's normal prompt autocomplete can handle argument text such as paths and `@` file references.

## Clean-session behavior

`/fresh` checks current agent idle state before replacing session. If Pi is busy, no new session is created.

On success it calls `ctx.newSession({ parentSession, withSession })` and uses only replacement-session `ctx` inside `withSession` to send replay with `sendUserMessage()`.

If session creation is cancelled by Pi or another extension, `/fresh` reports cancellation and sends no replay.

## Skill loading requirement

Chosen skill must be loaded in current session for validation. It must also be loaded in replacement session, because replay uses normal `/skill:<name>` expansion there.

## Development

```sh
npm install --prefix pi-warden/fresh-skill
npm test --prefix pi-warden/fresh-skill
```
