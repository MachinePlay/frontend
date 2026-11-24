/**
 * <game-tree> — an animated depth-first walk over a small game tree.
 *
 * Framework-agnostic custom element, no dependencies, no build step.
 *
 *   <script type="module" src="figures/game-tree.js"></script>
 *   <game-tree mode="minimax"></game-tree>
 *
 * React 19 renders custom elements natively and passes object props through as
 * properties, so porting the tutorial is just:
 *
 *   import "./figures/game-tree.js";
 *   <game-tree mode="minimax" tree={myTree} />
 *
 * Attributes / properties
 *   tree     tree spec (property: object, attribute: JSON string). See DEFAULT_TREE.
 *   mode     "minimax" (default) | "negamax" | "alphabeta" | "negamax-alphabeta"
 *   bounds   "off" hides the α/β line and phrases cutoffs as plain bounds
 *   speed    ms per step while playing (default 1100)
 *   autoplay start playing once the figure scrolls into view
 *
 * Styling: set the --gt-* custom properties on the element from outside.
 *
 * Tree spec:
 *   { name?, kind?: "max"|"min", children: [...] }   internal node
 *   { name?, value: number }                         leaf
 * `kind` defaults to alternating max/min starting at the root, and internal
 * nodes with no `name` are lettered A, B, C… breadth-first from the root.
 */

const DEFAULT_TREE = {
  kind: "max",
  children: [
    { children: [{ value: 4 }, { value: 8 }] },
    { children: [{ value: 3 }, { value: 2 }] },
  ],
};

/* ------------------------------------------------------------------ layout */

function prepare(spec) {
  const nodes = [];
  const byId = {};
  let leafCount = 0;

  function walk(node, parentId, depth, id) {
    const kids = node.children ?? [];
    const isLeaf = kids.length === 0;
    const n = {
      id,
      parent: parentId,
      depth,
      name: node.name ?? null,
      kind: isLeaf ? "leaf" : (node.kind ?? (depth % 2 === 0 ? "max" : "min")),
      value: isLeaf ? node.value : null,
      children: [],
      slot: 0,
    };
    nodes.push(n);
    byId[id] = n;

    if (isLeaf) {
      n.slot = leafCount++;
    } else {
      kids.forEach((kid, i) => n.children.push(walk(kid, id, depth + 1, `${id}.${i}`).id));
      const first = byId[n.children[0]].slot;
      const last = byId[n.children[n.children.length - 1]].slot;
      n.slot = (first + last) / 2;
    }
    return n;
  }

  const root = walk(spec, null, 0, "n");

  // Letter the internal nodes breadth-first, so the root is just "A".
  const lettered = nodes
    .filter((n) => n.kind !== "leaf")
    .sort((a, b) => a.depth - b.depth || a.slot - b.slot);
  lettered.forEach((n, i) => {
    n.name ??= String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "");
  });

  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  return { nodes, byId, rootId: root.id, leafCount, maxDepth };
}

/**
 * Rewrite a prepared layout into the negamax view: every node maximizes, and
 * every score is read from the point of view of whoever is to move there. The
 * original max/min stays on `side`, so the captions can still say whose move it
 * is. Leaf values live in white's units, so odd plies flip sign.
 */
function toNegamax(layout) {
  for (const n of layout.nodes) {
    n.side = n.kind;
    if (n.kind === "leaf") {
      if (n.depth % 2 === 1) n.value = -n.value;
    } else {
      n.kind = "max";
    }
  }
  layout.nega = true;
  return layout;
}

/* ------------------------------------------------------- search, as a trace */

/** Which nodes does alpha-beta ever look at? */
function alphabetaVisited(byId, rootId) {
  const seen = new Set();

  function visit(id, alpha, beta) {
    seen.add(id);
    const n = byId[id];
    if (n.kind === "leaf") return n.value;

    const isMax = n.kind === "max";
    let best = isMax ? -Infinity : Infinity;
    for (const cid of n.children) {
      const v = visit(cid, alpha, beta);
      if (isMax) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break; // cutoff: the rest of this node is unreachable
    }
    return best;
  }

  visit(rootId, -Infinity, Infinity);
  return seen;
}

const fmt = (x) => (x === Infinity ? "∞" : x === -Infinity ? "−∞" : String(x));
// Non-breaking space: keeps "≥ 4" together when a caption wraps.
const bound = (n, v) => (v === null ? "?" : n.kind === "max" ? `≥\u00a0${v}` : `≤\u00a0${v}`);

/** The big line inside a node box. */
const nodeLabel = (n, s) => {
  if (n.kind === "leaf") return `eval = ${s.value === null ? "?" : s.value}`;
  if (s.status === "done") return s.exact ? `score = ${s.value}` : `score ${bound(n, s.value)}`;
  if (s.status === "idle" || s.value === null) return "score = ?";
  return `score ${bound(n, s.value)}`;
};

/** The α/β line, shown only in alphabeta mode. */
const abLabel = (s) =>
  s.status === "idle" || s.alpha === null ? "" : `α ${fmt(s.alpha)}\u2003β ${fmt(s.beta)}`;
const who = (n) => ((n.side ?? n.kind) === "max" ? "you" : "your opponent");
const poss = (n) => ((n.side ?? n.kind) === "max" ? "your" : "your opponent's");
const nameOf = (n) => (n.name ? `<b>${n.name}</b>` : "this node");

/**
 * Walk the tree and record one snapshot per step, so the UI can scrub back and
 * forth instead of re-running the search.
 */
function buildTrace(byId, rootId, mode, redundant, showAb = mode.endsWith("alphabeta")) {
  const nega = mode.startsWith("negamax");
  const prune = mode.endsWith("alphabeta");
  const steps = [];
  const st = {};
  for (const id of Object.keys(byId)) {
    st[id] = { status: "idle", value: null, alpha: null, beta: null, exact: true };
  }

  let leaves = 0;
  let skipped = 0;

  const snap = (active, caption, extra = {}) => {
    steps.push({ active, caption, leaves, state: structuredClone(st), ...extra });
  };

  function markPruned(id) {
    st[id].status = "pruned";
    if (byId[id].kind === "leaf") skipped++;
    for (const cid of byId[id].children) markPruned(cid);
  }

  function visit(id, alpha, beta) {
    const n = byId[id];
    st[id].status = "open";
    if (prune) {
      st[id].alpha = alpha;
      st[id].beta = beta;
    }

    if (n.kind === "leaf") {
      leaves++;
      st[id].value = n.value;
      st[id].status = "done";
      snap(
        id,
        nega
          ? `Bottom of the tree. Evaluate the position for the side to move: <b>${n.value}</b>.`
          : `Bottom of the tree. Evaluate the position: <b>${n.value}</b>.`,
      );
      return n.value;
    }

    snap(
      id,
      nega
        ? `${n.parent ? "Walk down into" : "Start at"} ${nameOf(n)}. It is ${poss(n)} move, and the ` +
            `score belongs to whoever moves, so ${nameOf(n)} takes the biggest child like every ` +
            `other node. Nothing seen yet.`
        : `${n.parent ? "Walk down into" : "Start at"} ${nameOf(n)}. It is ${poss(n)} move, so ` +
            `${n.kind === "max" ? "the biggest" : "the smallest"} child wins. Nothing seen yet, so the ` +
            `score could still be anything.`,
    );

    const isMax = n.kind === "max";
    let best = isMax ? -Infinity : Infinity;
    let cut = false;

    for (let i = 0; i < n.children.length; i++) {
      const cid = n.children[i];
      // Negamax looks at the window from the child's side of the board too, so
      // it goes down swapped and negated.
      const raw = nega ? visit(cid, -beta, -alpha) : visit(cid, alpha, beta);
      // The whole of negamax: a child's score is the same number seen from the
      // other side of the board, so it comes back with its sign flipped.
      const v = nega ? -raw : raw;
      const improved = isMax ? v > best : v < best;
      if (improved) best = v;
      st[id].value = best;

      const first = i === 0;
      const back = nega
        ? `Back up with <b>${raw}</b>, which is <b>${v}</b> from here.`
        : `Back up with <b>${v}</b>.`;
      let text;
      if (first) {
        text =
          `${back} ${nameOf(n)} takes ${poss(n)} side, so from here its score can only ` +
          `${isMax ? "climb" : "fall"}: <b>${bound(n, best)}</b>.`;
      } else if (improved) {
        text = `${back} Better for ${who(n)}: ${nameOf(n)} is now <b>${bound(n, best)}</b>.`;
      } else {
        text = `${back} No better for ${who(n)}: ${nameOf(n)} stays <b>${bound(n, best)}</b>.`;
      }

      // The moment plain minimax commits to work it will not use: the next
      // child is one alpha-beta would already have skipped. Say so out loud --
      // this is the whole reason the next chapter exists.
      const nextCid = n.children[i + 1];
      const parent = n.parent ? byId[n.parent] : null;
      const pv = parent ? st[parent.id].value : null;
      const doomed = mode === "minimax" && nextCid && !redundant.has(nextCid) && pv !== null;
      if (doomed) {
        text +=
          ` Now compare: ${nameOf(parent)} is already <b>${bound(parent, pv)}</b>, and ${nameOf(n)} is ` +
          `<b>${bound(n, best)}</b>. ${nameOf(n)} can never win that comparison, so everything left ` +
          `underneath it is dead weight.`;
      }
      snap(id, text, { from: cid, doomed });

      if (prune) {
        if (nega) {
          if (best > alpha) alpha = best;
        } else {
          if (isMax && best > alpha) alpha = best;
          if (!isMax && best < beta) beta = best;
        }
        st[id].alpha = alpha;
        st[id].beta = beta;
        if (alpha >= beta && i < n.children.length - 1) {
          for (const rest of n.children.slice(i + 1)) markPruned(rest);
          cut = true;
          st[id].exact = false;
          const parentBound = parent ? bound(parent, st[parent.id].value) : null;
          snap(
            id,
            showAb
              ? `α ≥ β (<b>${fmt(alpha)}</b> ≥ <b>${fmt(beta)}</b>): whatever is left down here, ` +
                  `${who(n)} would never be allowed to reach it. <b>Cut off</b>: skip the rest of ${nameOf(n)}.`
              : `${nameOf(parent)} is already <b>${parentBound}</b> and ${nameOf(n)} is ` +
                  `<b>${bound(n, best)}</b>, so ${nameOf(n)} has already lost that comparison. ` +
                  `Nothing left underneath it can change the answer. <b>Skip it.</b>`,
            { cutoff: true },
          );
          break;
        }
      }
    }

    st[id].status = "done";
    const up = n.parent
      ? `, and that goes back up to ${nameOf(byId[n.parent])}.`
      : `. That is the move to play.`;
    snap(
      id,
      cut
        ? `${nameOf(n)} is finished at <b>${bound(n, best)}</b>: we never learned its exact score, only that ` +
            `it is ${isMax ? "at least" : "at most"} <b>${best}</b>${up}`
        : `${nameOf(n)} is finished at <b>${best}</b>${up}`,
    );
    return best;
  }

  visit(rootId, -Infinity, Infinity);

  const rootValue = st[rootId].value;
  // How much of this tree was pointless? Zero on a shallow tree, where there is
  // no earlier bound to compare against yet.
  const wasted = Object.values(byId).filter((n) => n.kind === "leaf" && !redundant.has(n.id)).length;
  const head = `Done: <b>${byId[rootId].name}</b> = <b>${rootValue}</b>`;
  steps.push({
    ...structuredClone(steps[steps.length - 1]),
    active: null,
    done: true,
    caption:
      !prune
        ? wasted > 0
          ? `${head}, after evaluating all <b>${leaves}</b> leaves. Every one of them was visited, ` +
            `whether or not it could still change the answer.`
          : `${head}, after evaluating all <b>${leaves}</b> leaves.`
        : skipped === 0
          ? `${head}, after evaluating every one of the <b>${leaves}</b> leaves. This order never ` +
            `produced a bound worth cutting on.`
          : `${head}, the same answer, after evaluating <b>${leaves}</b> leaves instead of ` +
            `${leaves + skipped}. The <b>${skipped}</b> skipped ${skipped === 1 ? "leaf" : "leaves"} ` +
            `could not have changed it.`,
  });

  return steps;
}

/* --------------------------------------------------------------------- view */

const CSS = `
:host {
  --gt-bg: #ffffff;
  --gt-panel: #f6f7f9;
  --gt-fg: #1c1e21;
  --gt-muted: #6b7280;
  --gt-line: #c8cdd4;
  --gt-max: #c62828;
  --gt-min: #1d4ed8;
  --gt-nega: #a16207;
  --gt-active: #7c3aed;
  --gt-cut: #7c3aed;

  display: block;
  color: var(--gt-fg);
  background: var(--gt-bg);
  border: 1px solid var(--gt-line);
  border-radius: 10px;
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  :host {
    --gt-bg: #14161a;
    --gt-panel: #1b1e24;
    --gt-fg: #e7e9ee;
    --gt-muted: #98a1af;
    --gt-line: #333944;
    --gt-max: #f4796b;
    --gt-min: #7aa7f5;
    --gt-nega: #fbbf24;
    --gt-active: #a78bfa;
    --gt-cut: #a78bfa;
  }
}

.stage { padding: 10px 6px 6px; overflow-x: auto; }
svg { display: block; width: 100%; height: auto; overflow: visible; }

.edge {
  stroke: var(--gt-line);
  stroke-width: 1.6;
  fill: none;
  transition: stroke .25s, stroke-width .25s, opacity .25s;
}
.edge.on   { stroke: var(--gt-active); stroke-width: 3; }
.edge.used { stroke: var(--gt-fg); stroke-width: 2; opacity: .5; }
.edge.pruned { stroke-dasharray: 3 4; opacity: .35; }

.node .box {
  fill: var(--gt-panel);
  stroke: var(--gt-line);
  stroke-width: 1.6;
  transition: stroke .25s, stroke-width .25s, fill .25s;
}
.node .name  { fill: var(--gt-muted); font-size: 11px; letter-spacing: .02em; }
.node .val   { fill: var(--gt-fg); font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.node .ab    { fill: var(--gt-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.node text { text-anchor: middle; dominant-baseline: middle; }

.node.max .name { fill: var(--gt-max); }
.node.min .name { fill: var(--gt-min); }
.node.max .box  { stroke: var(--gt-max); }
.node.min .box  { stroke: var(--gt-min); }
.node.nega .name { fill: var(--gt-nega); }
.node.nega .box  { stroke: var(--gt-nega); }

.node.idle   { opacity: .4; }
.node.open .box { stroke-width: 2.2; }
.node.done .box { fill: color-mix(in srgb, var(--gt-fg) 8%, var(--gt-panel)); }
.node.pruned { opacity: .28; }
.node.pruned .box { stroke-dasharray: 3 4; }

.node.active .box {
  stroke: var(--gt-active);
  stroke-width: 3;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--gt-active) 45%, transparent));
}
.node { transition: opacity .25s; }

.bar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--gt-line);
  background: var(--gt-panel);
  flex-wrap: wrap;
}
button {
  font: inherit; color: inherit;
  background: var(--gt-bg);
  border: 1px solid var(--gt-line);
  border-radius: 6px;
  padding: 3px 10px;
  cursor: pointer;
  min-width: 34px;
}
button:hover:not(:disabled) { border-color: var(--gt-active); }
button:disabled { opacity: .4; cursor: default; }
button.play { font-weight: 600; min-width: 78px; }
.meter { margin-left: auto; color: var(--gt-muted); font-variant-numeric: tabular-nums; font-size: 12.5px; }

.caption {
  padding: 10px 12px;
  border-top: 1px solid var(--gt-line);
  min-height: 3.4em;
  color: var(--gt-fg);
}
.caption b { font-weight: 650; }
.caption.cutoff { color: var(--gt-cut); }

@media (prefers-reduced-motion: reduce) {
  .edge, .node, .node .box { transition: none; }
}
`;

const LEAF_W = 90;
const LEAF_H = 46;
const H_GAP = 136;
const PAD = 24;

/** Node box and text metrics, which depend on whether α/β needs a third line. */
const metrics = (mode, showAb = mode.endsWith("alphabeta")) =>
  showAb
    ? { w: 120, h: 72, nameDy: -23, valDy: 0, abDy: 22, vGap: 124 }
    : { w: 116, h: 56, nameDy: -13, valDy: 10, abDy: null, vGap: 112 };

const SVG_NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// So the module can also be imported by export.mjs under Node, where there is
// no DOM. The class is only ever instantiated by the browser.
const Base = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

class GameTree extends Base {
  static observedAttributes = ["tree", "mode", "bounds", "speed", "autoplay"];

  #tree = null;
  #steps = [];
  #i = 0;
  #timer = null;
  #built = false;
  #observer = null;
  #layout = null;
  #els = null;

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.#build();
  }

  disconnectedCallback() {
    this.pause();
    this.#observer?.disconnect();
  }

  attributeChangedCallback() {
    if (this.#built) this.#build();
  }

  set tree(spec) {
    this.#tree = spec;
    if (this.#built) this.#build();
  }
  get tree() {
    return this.#tree;
  }

  get #mode() {
    const mode = this.getAttribute("mode");
    return ["alphabeta", "negamax", "negamax-alphabeta"].includes(mode) ? mode : "minimax";
  }
  get #showAb() {
    return this.#mode.endsWith("alphabeta") && this.getAttribute("bounds") !== "off";
  }
  get #speed() {
    return Number(this.getAttribute("speed")) || 1100;
  }

  #build() {
    this.pause();
    let spec = this.#tree;
    if (!spec && this.hasAttribute("tree")) {
      try {
        spec = JSON.parse(this.getAttribute("tree"));
      } catch {
        spec = null;
      }
    }
    spec ??= DEFAULT_TREE;

    this.#layout = prepare(spec);
    if (this.#mode.startsWith("negamax")) toNegamax(this.#layout);
    const { byId, rootId } = this.#layout;
    this.#steps = buildTrace(byId, rootId, this.#mode, alphabetaVisited(byId, rootId), this.#showAb);
    this.#i = 0;
    this.#render();
    this.#built = true;

    if (this.hasAttribute("autoplay")) this.#watchViewport();
  }

  #watchViewport() {
    this.#observer?.disconnect();
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && this.#i === 0 && !this.#timer) {
            this.play();
            this.#observer.disconnect();
          }
        }
      },
      { threshold: 0.6 },
    );
    this.#observer.observe(this);
  }

  #render() {
    const { nodes, byId, leafCount, maxDepth } = this.#layout;
    const m = metrics(this.#mode, this.#showAb);
    const width = leafCount * H_GAP + PAD * 2;
    const height = maxDepth * m.vGap + Math.max(m.h, LEAF_H) + PAD * 2;

    const root = document.createElement("div");
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="stage"><svg viewBox="0 0 ${width} ${height}" role="img"
           style="min-width:${width > 620 ? width : 0}px"></svg></div>
      <div class="bar">
        <button data-act="reset" title="Back to the start">⟲</button>
        <button data-act="prev" title="Previous step">‹</button>
        <button data-act="play" class="play"></button>
        <button data-act="next" title="Next step">›</button>
        <span class="meter"></span>
      </div>
      <div class="caption" aria-live="polite"></div>
    `;

    const svg = root.querySelector("svg");
    const pos = (n) => ({
      x: PAD + (n.slot + 0.5) * H_GAP,
      y: PAD + n.depth * m.vGap + m.h / 2,
    });
    const boxH = (n) => (n.kind === "leaf" ? LEAF_H : m.h);

    const edges = {};
    const gEdges = el("g");
    svg.append(gEdges);
    for (const n of nodes) {
      if (!n.parent) continue;
      const p = pos(byId[n.parent]);
      const c = pos(n);
      const line = el("path", {
        class: "edge",
        d: `M ${p.x} ${p.y + boxH(byId[n.parent]) / 2} L ${c.x} ${c.y - boxH(n) / 2}`,
      });
      edges[n.id] = line;
      gEdges.append(line);
    }

    const parts = {};
    for (const n of nodes) {
      const { x, y } = pos(n);
      const leaf = n.kind === "leaf";
      const w = leaf ? LEAF_W : m.w;
      const h = leaf ? LEAF_H : m.h;
      const g = el("g", { class: `node ${n.kind}${this.#layout.nega && !leaf ? " nega" : ""}` });
      g.append(
        el("rect", { class: "box", x: x - w / 2, y: y - h / 2, width: w, height: h, rx: leaf ? 7 : 9 }),
      );

      if (!leaf) {
        const name = el("text", { class: "name", x, y: y + m.nameDy });
        name.textContent = `${n.name} ${n.kind === "max" ? "▲ max" : "▼ min"}`;
        g.append(name);
      }

      const val = el("text", { class: "val", x, y: leaf ? y : y + m.valDy });
      g.append(val);

      let ab = null;
      if (!leaf && m.abDy !== null) {
        ab = el("text", { class: "ab", x, y: y + m.abDy });
        g.append(ab);
      }

      svg.append(g);
      parts[n.id] = { g, val, ab };
    }

    this.#els = {
      edges,
      parts,
      caption: root.querySelector(".caption"),
      meter: root.querySelector(".meter"),
      buttons: Object.fromEntries(
        [...root.querySelectorAll("button")].map((b) => [b.dataset.act, b]),
      ),
    };

    root.querySelector(".bar").addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "reset") this.reset();
      else if (act === "prev") this.step(-1);
      else if (act === "next") this.step(1);
      else if (act === "play") this.#timer ? this.pause() : this.play();
    });

    this.tabIndex = 0;
    this.onkeydown = (e) => {
      if (e.key === "ArrowRight") this.step(1);
      else if (e.key === "ArrowLeft") this.step(-1);
      else if (e.key === " ") this.#timer ? this.pause() : this.play();
      else return;
      e.preventDefault();
    };

    this.shadowRoot.replaceChildren(...root.childNodes);
    this.#paint();
  }

  #paint() {
    const step = this.#steps[this.#i];
    const { byId } = this.#layout;
    const { parts, edges, caption, meter, buttons } = this.#els;

    for (const [id, { g, val, ab }] of Object.entries(parts)) {
      const n = byId[id];
      const s = step.state[id];

      g.setAttribute(
        "class",
        [
          "node",
          n.kind,
          this.#layout.nega && n.kind !== "leaf" ? "nega" : "",
          s.status,
          step.active === id ? "active" : "",
        ]
          .filter(Boolean)
          .join(" "),
      );

      val.textContent = nodeLabel(n, s);
      if (ab) ab.textContent = abLabel(s);
    }

    for (const [id, line] of Object.entries(edges)) {
      const s = step.state[id];
      const onPath = step.active === id || step.from === id;
      line.setAttribute(
        "class",
        [
          "edge",
          onPath ? "on" : s.status === "idle" ? "" : "used",
          s.status === "pruned" ? "pruned" : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    caption.innerHTML = step.caption;
    caption.className = `caption${step.cutoff ? " cutoff" : ""}`;
    meter.textContent = `step ${this.#i + 1} / ${this.#steps.length} · leaves evaluated ${step.leaves}`;

    buttons.prev.disabled = this.#i === 0;
    buttons.next.disabled = this.#i === this.#steps.length - 1;
    buttons.play.textContent = this.#timer
      ? "⏸ Pause"
      : this.#i === this.#steps.length - 1
        ? "⟲ Replay"
        : "▶ Play";
  }

  /* ------------------------------------------------------------- public API */

  step(delta = 1) {
    const next = this.#i + delta;
    if (next < 0 || next >= this.#steps.length) return false;
    this.#i = next;
    this.#paint();
    return true;
  }

  play() {
    if (this.#i === this.#steps.length - 1) this.#i = 0;
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      if (!this.step(1)) this.pause();
    }, this.#speed);
    this.#paint();
  }

  pause() {
    clearInterval(this.#timer);
    this.#timer = null;
    if (this.#els) this.#paint();
  }

  reset() {
    this.pause();
    this.#i = 0;
    this.#paint();
  }
}

if (typeof customElements !== "undefined") customElements.define("game-tree", GameTree);

export { GameTree, DEFAULT_TREE };
// Internals, shared with export.mjs so the static SVGs cannot drift from the
// live figures.
export {
  toNegamax,
  prepare,
  buildTrace,
  alphabetaVisited,
  metrics,
  nodeLabel,
  abLabel,
  LEAF_W,
  LEAF_H,
  H_GAP,
  PAD,
};
