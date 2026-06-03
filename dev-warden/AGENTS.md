# dev-warden Agent Guidance

`dev-warden` is the future developer-environment package area.

Current status: skeleton only.

## Rules

- Do not implement dev-environment product behavior in bootstrap groundwork.
- Keep this subproject independently testable.
- Add product code only when a later feature explicitly scopes it.

## Tests

```sh
mise run test:dev-warden
```
