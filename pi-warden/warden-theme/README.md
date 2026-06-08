# @nekwebdev/warden-theme

Warden Pi Agent theme package with one complete Catppuccin Mocha-derived dark theme: `warden-catppuccin-mocha`.

Load from the Warden repo root during development:

```sh
pi -e ./pi-warden/warden-theme
```

Then open `/settings` and select `warden-catppuccin-mocha`.

Direct theme-file loading also works:

```sh
pi --theme ./pi-warden/warden-theme/themes/warden-catppuccin-mocha.json
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

Pi loads `themes/warden-catppuccin-mocha.json` from that directory.

## Catppuccin Mocha color values

`warden-catppuccin-mocha` defines official Catppuccin Mocha hex values in `vars` and references those vars from `colors` and `export`.

Palette intent for dark transparent terminals:

- Use `text`, `subtext*`, and `overlay*` for readable foreground hierarchy.
- Use `surface*`, `mantle`, and `crust` for quiet panels and backgrounds.
- Reserve accent hues for selected UI, labels, markdown, diffs, syntax, thinking borders, and bash mode.
- Avoid bright state backgrounds; tool backgrounds stay on surface colors so accents and important text pop without overwhelming the terminal.

Pi color value forms available to themes:

- `""` means terminal default foreground/background where a token supports text/default behavior.
- `0-15` are terminal-dependent ANSI colors.
- `16-231` are fixed xterm RGB cube colors.
- `232-255` are xterm grayscale ramp colors.
- `#rrggbb` gives explicit RGB independent of terminal palette, subject to terminal truecolor support/fallback.
- Vars can name reusable values in theme JSON.

## Theme vars

| Var | Value | Source type |
|-----|-------|-------------|
| `rosewater` | `#f5e0dc` | Catppuccin Mocha |
| `flamingo` | `#f2cdcd` | Catppuccin Mocha |
| `pink` | `#f5c2e7` | Catppuccin Mocha |
| `mauve` | `#cba6f7` | Catppuccin Mocha |
| `red` | `#f38ba8` | Catppuccin Mocha |
| `maroon` | `#eba0ac` | Catppuccin Mocha |
| `peach` | `#fab387` | Catppuccin Mocha |
| `yellow` | `#f9e2af` | Catppuccin Mocha |
| `green` | `#a6e3a1` | Catppuccin Mocha |
| `teal` | `#94e2d5` | Catppuccin Mocha |
| `sky` | `#89dceb` | Catppuccin Mocha |
| `sapphire` | `#74c7ec` | Catppuccin Mocha |
| `blue` | `#89b4fa` | Catppuccin Mocha |
| `lavender` | `#b4befe` | Catppuccin Mocha |
| `text` | `#cdd6f4` | Catppuccin Mocha |
| `subtext1` | `#bac2de` | Catppuccin Mocha |
| `subtext0` | `#a6adc8` | Catppuccin Mocha |
| `overlay2` | `#9399b2` | Catppuccin Mocha |
| `overlay1` | `#7f849c` | Catppuccin Mocha |
| `overlay0` | `#6c7086` | Catppuccin Mocha |
| `surface2` | `#585b70` | Catppuccin Mocha |
| `surface1` | `#45475a` | Catppuccin Mocha |
| `surface0` | `#313244` | Catppuccin Mocha |
| `base` | `#1e1e2e` | Catppuccin Mocha |
| `mantle` | `#181825` | Catppuccin Mocha |
| `crust` | `#11111b` | Catppuccin Mocha |

## Pi color token inventory

### Core UI

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `accent` | Primary accent, logo, selected items, cursor | Mocha accent var | `mauve` |
| `border` | Normal borders | Mocha overlay var | `overlay0` |
| `borderAccent` | Highlighted borders | Mocha accent var | `teal` |
| `borderMuted` | Subtle borders | Mocha surface var | `surface1` |
| `success` | Success states | Mocha state var | `green` |
| `error` | Error states | Mocha state var | `red` |
| `warning` | Warning states | Mocha state var | `peach` |
| `muted` | Secondary text | Mocha text var | `subtext0` |
| `dim` | Tertiary text | Mocha overlay var | `overlay1` |
| `text` | Default text | Mocha text var | `text` |
| `thinkingText` | Thinking block text | Mocha text var | `subtext1` |

### Backgrounds & Content

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `selectedBg` | Selected line background | Mocha surface var | `surface1` |
| `userMessageBg` | User message background | Mocha surface var | `surface0` |
| `userMessageText` | User message text | Mocha text var | `text` |
| `customMessageBg` | Extension message background | Mocha surface var | `surface0` |
| `customMessageText` | Extension message text | Mocha text var | `text` |
| `customMessageLabel` | Extension message label | Mocha accent var | `mauve` |
| `toolPendingBg` | Tool box pending state | Mocha surface var | `surface0` |
| `toolSuccessBg` | Tool box success state | Mocha surface var | `surface1` |
| `toolErrorBg` | Tool box error state | Mocha surface var | `surface1` |
| `toolTitle` | Tool title | Mocha accent text var | `lavender` |
| `toolOutput` | Tool output text | Mocha text var | `subtext1` |

### Markdown

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `mdHeading` | Headings | Mocha accent var | `peach` |
| `mdLink` | Link text | Mocha accent var | `blue` |
| `mdLinkUrl` | Link URL | Mocha accent var | `sapphire` |
| `mdCode` | Inline code | Mocha accent var | `teal` |
| `mdCodeBlock` | Code block content | Mocha text var | `text` |
| `mdCodeBlockBorder` | Code block fences | Mocha surface var | `surface2` |
| `mdQuote` | Blockquote text | Mocha text var | `subtext0` |
| `mdQuoteBorder` | Blockquote border | Mocha overlay var | `overlay0` |
| `mdHr` | Horizontal rule | Mocha surface var | `surface2` |
| `mdListBullet` | List bullets | Mocha accent var | `mauve` |

### Tool Diffs

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `toolDiffAdded` | Added lines | Mocha state var | `green` |
| `toolDiffRemoved` | Removed lines | Mocha state var | `red` |
| `toolDiffContext` | Context lines | Mocha text var | `subtext0` |

### Syntax Highlighting

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `syntaxComment` | Comments | Mocha overlay var | `overlay1` |
| `syntaxKeyword` | Keywords | Mocha accent var | `mauve` |
| `syntaxFunction` | Function names | Mocha accent var | `blue` |
| `syntaxVariable` | Variables | Mocha text var | `text` |
| `syntaxString` | Strings | Mocha state var | `green` |
| `syntaxNumber` | Numbers | Mocha accent var | `peach` |
| `syntaxType` | Types | Mocha accent var | `teal` |
| `syntaxOperator` | Operators | Mocha accent text var | `lavender` |
| `syntaxPunctuation` | Punctuation | Mocha text var | `subtext1` |

### Thinking Level Borders

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `thinkingOff` | Thinking off | Mocha surface var | `surface2` |
| `thinkingMinimal` | Minimal thinking | Mocha overlay var | `overlay1` |
| `thinkingLow` | Low thinking | Mocha accent var | `sapphire` |
| `thinkingMedium` | Medium thinking | Mocha accent var | `teal` |
| `thinkingHigh` | High thinking | Mocha accent var | `mauve` |
| `thinkingXhigh` | Extra high thinking | Mocha accent var | `pink` |

### Bash Mode

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `bashMode` | Editor border in bash mode (`!` prefix) | Mocha state var | `green` |

## Optional HTML export colors

HTML export does not inherit a terminal palette. These values use Catppuccin Mocha vars for exported pages.

| Token | Purpose | Recommended source type | `warden-catppuccin-mocha` value |
|-------|---------|-------------------------|-------------------------|
| `export.pageBg` | Export page background | Mocha background var | `crust` |
| `export.cardBg` | Export card/container background | Mocha background var | `mantle` |
| `export.infoBg` | Export info-section background | Mocha surface var | `surface0` |

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
3. Select `warden-catppuccin-mocha`.
4. Inspect core UI, markdown, tool box states, diffs, syntax highlighting, thinking-level borders, and bash-mode border.
