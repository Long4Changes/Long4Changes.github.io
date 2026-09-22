# 0002. Vue DOM Terminal with split-pane ASCII Window Cards

## Context

The design merges two distinct terminal styles: an interactive Web shell (`jiangyy.github.io`) and retro ASCII window frames with clean reading typography (`kanjousen.com`). Standard virtual terminal emulators like `xterm.js` render to canvas grids, making rich Markdown formatting, variable fonts, and responsive window panels difficult to implement and style.

## Decision

We implement the Terminal as a custom Vue 3 DOM component hierarchy instead of canvas-based `xterm.js`. Short command responses print inline in the Terminal stream, while long-form Document reading triggers a side-by-side or collapsible split-pane ASCII Window Card.

## Consequences

- Direct integration with Vue 3 reactive state, transitions, and native HTML DOM rendering.
- Markdown content in Window Cards supports syntax-highlighted code blocks and custom typography while keeping the outer retro ASCII border intact.
- Avoids the weight and rendering limitations of canvas-based terminal emulators for rich content.
