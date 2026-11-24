# frontend

## Design system

Dark only, warm neutrals, one amber accent. Tokens are Tailwind v4 theme
variables in `src/index.css` (`bg-surface`, `text-muted`, `border-line`, …);
reach for them rather than raw colours.

| Token | Use |
| --- | --- |
| `bg` `surface` `surface-2` | page, panels/inputs/code, selected nav item |
| `line` `line-strong` `line-row` | borders, secondary-button border, list-row separators |
| `track` | empty part of progress bars, meters, eval bars |
| `fg` `muted` `faint` | text, secondary text, labels (faint still meets 4.5:1 on `bg`) |
| `accent` | **only things happening now**: live dot, Running, Following live, the watched game, "thinking" |
| `win` `loss` | **only results and rating deltas** (`loss` doubles as danger); `win` also marks an online runner |

- Type: IBM Plex Sans (variable; body at weight 450, since 400 looks
  hairline light-on-dark) for UI, Plex Mono with tabular figures (the `num`
  utility) for numbers, clocks, moves, ratings, versions and evals. Sizes,
  half a step above the original handoff: `text-title` 29 page titles,
  `text-section` 19 section titles, `text-md` 15.5, `text-sm` 14.5 body,
  `text-meta` 13.5, `text-xs` 12.5.
- Copy is sentence case. Usernames and engine names stay as entered.
- Lists are hairline rows (`border-line-row`), not bordered cards. Panels are
  `rounded-lg` with a `line` border; controls `rounded` (4px). No shadows.
- The live dot is static: the accent alone says "now".
- Pages sit in `Page` (`src/ui.tsx`): max 1160px, 40px top padding, 40px
  section gap, 16px side gutter on phones.

Primitives (buttons, inputs, segmented control, switch, tabs, pills, meters,
the two-step `ConfirmButton` and typed-phrase `DangerZone`) live in
`src/ui.tsx` with their class strings in `src/styles.ts`; game rows, live
cards and status pills in `src/components.tsx`. Boards are chessground with
cburnett pieces on lichess brown dimmed for the dark page (`--board-light`
`#e4ceac`, `--board-dark` `#ac845f`).

## License

`AGPL-3.0-or-later`; see [LICENSE](LICENSE).
