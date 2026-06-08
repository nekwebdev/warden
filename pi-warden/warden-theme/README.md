# @nekwebdev/warden-theme

Warden Pi Agent theme package with one complete ANSI/default-first theme: `warden-terminal`.

Load from the Warden repo root during development:

```sh
pi -e ./pi-warden/warden-theme
```

Then open `/settings` and select `warden-terminal`.

Direct theme-file loading also works:

```sh
pi --theme ./pi-warden/warden-theme/themes/warden-terminal.json
```

## Package resources

`package.json` declares:

```json
{
  "pi": {
    "themes": ["./themes"]
  }
}
```

Pi loads `themes/warden-terminal.json` from that directory.

## Terminal-derived color values

For this package, “terminal-derived” means Pi-referenceable terminal/default/palette values, not active terminal palette probing. This slice does not query the running terminal with OSC or any other live palette protocol.

Running-terminal-derived values Pi can directly use:

- `""` means terminal default foreground/background where a token supports text/default behavior.
- `0-15` are terminal-dependent ANSI colors.
- `16-231` are fixed xterm RGB cube colors.
- `232-255` are xterm grayscale ramp colors.
- `#rrggbb` gives explicit RGB independent of terminal palette, subject to terminal truecolor support/fallback.
- Vars can name reusable values in theme JSON.

`warden-terminal` uses `""` for default text-like tokens and vars that point at terminal-dependent ANSI indexes `0-15` for accents, states, borders, markdown, diffs, syntax, thinking levels, and bash mode.

## Theme vars

| Var | Value | Source type |
|-----|-------|-------------|
| `ansiBlack` | `0` | Terminal ANSI |
| `ansiRed` | `1` | Terminal ANSI |
| `ansiGreen` | `2` | Terminal ANSI |
| `ansiYellow` | `3` | Terminal ANSI |
| `ansiBlue` | `4` | Terminal ANSI |
| `ansiMagenta` | `5` | Terminal ANSI |
| `ansiCyan` | `6` | Terminal ANSI |
| `ansiWhite` | `7` | Terminal ANSI |
| `ansiBrightBlack` | `8` | Terminal ANSI |
| `ansiBrightRed` | `9` | Terminal ANSI |
| `ansiBrightGreen` | `10` | Terminal ANSI |
| `ansiBrightYellow` | `11` | Terminal ANSI |
| `ansiBrightBlue` | `12` | Terminal ANSI |
| `ansiBrightMagenta` | `13` | Terminal ANSI |
| `ansiBrightCyan` | `14` | Terminal ANSI |
| `ansiBrightWhite` | `15` | Terminal ANSI |

## Pi color token inventory

### Core UI

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `accent` | Primary accent, logo, selected items, cursor | Terminal ANSI var | `ansiBrightCyan` |
| `border` | Normal borders | Terminal ANSI var | `ansiBlue` |
| `borderAccent` | Highlighted borders | Terminal ANSI var | `ansiCyan` |
| `borderMuted` | Subtle borders | Terminal ANSI var | `ansiBrightBlack` |
| `success` | Success states | Terminal ANSI var | `ansiGreen` |
| `error` | Error states | Terminal ANSI var | `ansiRed` |
| `warning` | Warning states | Terminal ANSI var | `ansiYellow` |
| `muted` | Secondary text | Terminal ANSI var | `ansiWhite` |
| `dim` | Tertiary text | Terminal ANSI var | `ansiBrightBlack` |
| `text` | Default text | Terminal default | `""` |
| `thinkingText` | Thinking block text | Terminal ANSI var | `ansiWhite` |

### Backgrounds & Content

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `selectedBg` | Selected line background | Terminal ANSI var | `ansiBrightBlack` |
| `userMessageBg` | User message background | Terminal ANSI var | `ansiBlack` |
| `userMessageText` | User message text | Terminal default | `""` |
| `customMessageBg` | Extension message background | Terminal ANSI var | `ansiMagenta` |
| `customMessageText` | Extension message text | Terminal default | `""` |
| `customMessageLabel` | Extension message label | Terminal ANSI var | `ansiBrightMagenta` |
| `toolPendingBg` | Tool box pending state | Terminal ANSI var | `ansiBrightBlack` |
| `toolSuccessBg` | Tool box success state | Terminal ANSI var | `ansiMagenta` |
| `toolErrorBg` | Tool box error state | Terminal ANSI var | `ansiRed` |
| `toolTitle` | Tool title | Terminal ANSI var | `ansiBrightWhite` |
| `toolOutput` | Tool output text | Terminal default | `""` |

### Markdown

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `mdHeading` | Headings | Terminal ANSI var | `ansiBrightYellow` |
| `mdLink` | Link text | Terminal ANSI var | `ansiBrightBlue` |
| `mdLinkUrl` | Link URL | Terminal ANSI var | `ansiCyan` |
| `mdCode` | Inline code | Terminal ANSI var | `ansiBrightCyan` |
| `mdCodeBlock` | Code block content | Terminal default | `""` |
| `mdCodeBlockBorder` | Code block fences | Terminal ANSI var | `ansiBrightBlack` |
| `mdQuote` | Blockquote text | Terminal ANSI var | `ansiWhite` |
| `mdQuoteBorder` | Blockquote border | Terminal ANSI var | `ansiBlue` |
| `mdHr` | Horizontal rule | Terminal ANSI var | `ansiBrightBlack` |
| `mdListBullet` | List bullets | Terminal ANSI var | `ansiBrightCyan` |

### Tool Diffs

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `toolDiffAdded` | Added lines | Terminal ANSI var | `ansiGreen` |
| `toolDiffRemoved` | Removed lines | Terminal ANSI var | `ansiRed` |
| `toolDiffContext` | Context lines | Terminal ANSI var | `ansiWhite` |

### Syntax Highlighting

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `syntaxComment` | Comments | Terminal ANSI var | `ansiBrightBlack` |
| `syntaxKeyword` | Keywords | Terminal ANSI var | `ansiBrightBlue` |
| `syntaxFunction` | Function names | Terminal ANSI var | `ansiBrightCyan` |
| `syntaxVariable` | Variables | Terminal ANSI var | `ansiBrightYellow` |
| `syntaxString` | Strings | Terminal ANSI var | `ansiBrightGreen` |
| `syntaxNumber` | Numbers | Terminal ANSI var | `ansiBrightMagenta` |
| `syntaxType` | Types | Terminal ANSI var | `ansiCyan` |
| `syntaxOperator` | Operators | Terminal ANSI var | `ansiBrightWhite` |
| `syntaxPunctuation` | Punctuation | Terminal ANSI var | `ansiWhite` |

### Thinking Level Borders

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `thinkingOff` | Thinking off | Terminal ANSI var | `ansiBrightBlack` |
| `thinkingMinimal` | Minimal thinking | Terminal ANSI var | `ansiWhite` |
| `thinkingLow` | Low thinking | Terminal ANSI var | `ansiBlue` |
| `thinkingMedium` | Medium thinking | Terminal ANSI var | `ansiCyan` |
| `thinkingHigh` | High thinking | Terminal ANSI var | `ansiMagenta` |
| `thinkingXhigh` | Extra high thinking | Terminal ANSI var | `ansiBrightMagenta` |

### Bash Mode

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `bashMode` | Editor border in bash mode (`!` prefix) | Terminal ANSI var | `ansiGreen` |

## Optional HTML export colors

HTML export does not inherit a terminal palette. These values are explicit RGB fallbacks for exported pages.

| Token | Purpose | Recommended source type | `warden-terminal` value |
|-------|---------|-------------------------|-------------------------|
| `export.pageBg` | Export page background | Explicit RGB | `#101014` |
| `export.cardBg` | Export card/container background | Explicit RGB | `#18181d` |
| `export.infoBg` | Export info-section background | Explicit RGB | `#242018` |

## Verification

Run package-local validation:

```sh
npm test --prefix pi-warden/warden-theme
```

Run package-area validation from repo root after changing package list docs or smoke tests:

```sh
mise run test:pi-warden
```

Manual visual check:

1. Run `pi -e ./pi-warden/warden-theme` from repo root.
2. Open `/settings`.
3. Select `warden-terminal`.
4. Inspect core UI, markdown, tool box states, diffs, syntax highlighting, thinking-level borders, and bash-mode border.
