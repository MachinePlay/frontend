# Interactive figures

Figures for the engine tutorial (`../engine-tutorial.md`, served at `/docs/engine-tutorial`).
`pages/Docs.tsx` imports `game-tree.js` to register the element, and `docs/index.ts` maps
`figures/*.svg` references in the markdown to the URLs Vite emits.

- `game-tree.js` — `<game-tree>`, an animated depth-first walk over a small
  game tree, showing each node's running score and the bound it already
  guarantees (`score ≥ 4` on a max node, `score ≤ 3` on a min node).
- `board.py` — renders every static chess board (`uv run --with chess python figures/board.py` from `src/docs`): the
  starting position, the two Depth 1 material boards, and the piece-square tables. All of
  them come out of python-chess's own renderer, the material one by swapping each piece for
  its worth and the tables by tinting squares and writing the number in, so they line up
  square for square.
- `export.mjs` — renders each figure to a standalone SVG (`node figures/export.mjs`).
  It imports the geometry and label helpers from `game-tree.js`, so the static
  and interactive versions cannot drift apart. Re-run it after changing any
  caption, value or dimension.
- `fig-*.svg` — the generated stand-ins. Each shows its tree in the finished
  state plus every step's commentary, so the tutorial can be proofread with the
  figures in place. Do not hand-edit them.
- `preview.html` — local harness for the interactive figures. `python3 -m http.server`
  from `src/docs`, then open `/figures/preview.html`. (A `file://` URL will not
  work; ES modules need a real origin.)
- `proof.html` — the same four figures as static SVGs, i.e. what a reader without
  JavaScript sees.

## Using one

```html
<script type="module" src="figures/game-tree.js"></script>
<game-tree mode="minimax"></game-tree>
```

`mode` is `minimax` (default), `negamax`, `alphabeta` or `negamax-alphabeta`.
`bounds="off"` hides the α/β line and phrases cutoffs as plain bounds instead,
which is how the alpha-beta chapter introduces the idea before naming it. Both run the same tree, so they can
be read side by side: on the default tree `C` finishes at `score = 2` under
minimax but `score ≤ 3` under alpha-beta, because the leaf worth 2 was never
looked at. The value alpha-beta comes back with is a bound rather than the true
score — wrong, and provably harmless, since the root picks `A = 4` either way.

`negamax` mode reads the same tree from the point of view of whoever is to move:
every node becomes a max node (drawn in one colour instead of red/blue), leaf
values at odd plies flip sign, and each child is negated on the way up. Same
root value, same move.

In `minimax` mode the figure also runs alpha-beta invisibly alongside, so it can
point out in the caption the exact step at which the remaining work became
pointless. That is the motivation for the alpha-beta chapter.

Other attributes: `speed` (ms per step, default 1100), `autoplay` (start playing
once scrolled into view), `tree` (a JSON tree spec; also settable as a property).

Tree spec — `kind` defaults to alternating max/min from the root:

```js
document.querySelector("game-tree").tree = {
  kind: "max",
  children: [
    { children: [{ value: 4 }, { value: 8 }] },
    { children: [{ value: 3 }, { value: 2 }] },
  ],
};
```

Internal nodes with no `name` are lettered `A`, `B`, `C`… breadth-first, so the
root is just `A`. Leaves are unlabelled and show `eval = n`.

## Renderers without JavaScript

GitHub's markdown renderer strips `<script>`, and so do most markdown previewers,
so the figures do not animate there. Each `<game-tree>` in `engine-tutorial.md` wraps its
static SVG as light-DOM fallback:

```html
<game-tree tree='{"kind":"max","children":[{"value":1},{"value":3},{"value":2}]}'>
  <img src="figures/fig-depth1-max.svg" alt="…">
</game-tree>
```

Shadow DOM hides light-DOM children as soon as the element upgrades, so a browser
with JavaScript shows the interactive figure and everything else shows the SVG —
no duplication, no blank gap. The SVGs carry their own light and dark palettes and
follow `prefers-color-scheme` even when loaded through `<img>`.
