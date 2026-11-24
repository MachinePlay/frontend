/**
 * Render each <game-tree> figure to a standalone SVG.
 *
 *   node figures/export.mjs
 *
 * The SVGs are static stand-ins for the interactive figures, for renderers that
 * strip <script> (GitHub, most markdown previewers). Each one shows the tree in
 * its finished state plus every step's commentary, so the tutorial can be
 * proofread with the figures in place.
 *
 * Geometry, palette and label formatting are imported from game-tree.js, so the
 * static and interactive versions cannot drift apart.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  prepare,
  toNegamax,
  buildTrace,
  alphabetaVisited,
  metrics,
  nodeLabel,
  abLabel,
  LEAF_W,
  LEAF_H,
  H_GAP,
  PAD,
} from "./game-tree.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ figures */

const FIGURES = [
  {
    file: "fig-depth1-max.svg",
    title: "Depth 1 — you are choosing",
    mode: "minimax",
    tree: { kind: "max", children: [{ value: 1 }, { value: 3 }, { value: 2 }] },
  },
  {
    file: "fig-depth1-min.svg",
    title: "Depth 1 — your opponent is choosing",
    mode: "minimax",
    tree: { kind: "min", children: [{ value: 3 }, { value: 1 }, { value: 2 }] },
  },
  {
    file: "fig-minimax.svg",
    title: "Minimax, two levels deep",
    mode: "minimax",
    tree: null, // the default tree
  },
  {
    file: "fig-negamax.svg",
    title: "The same tree, read as negamax",
    mode: "negamax",
    tree: null,
  },
  {
    file: "fig-prune.svg",
    title: "The same tree, minus one leaf",
    mode: "alphabeta",
    showAb: false,
    tree: null,
  },
  {
    file: "fig-alphabeta.svg",
    title: "Alpha-beta, with the window it carries",
    mode: "negamax-alphabeta",
    tree: null,
  },
  {
    file: "fig-order-worst.svg",
    title: "Worst possible move order: nothing to cut",
    mode: "alphabeta",
    tree: {"kind":"max","children":[{"children":[{"children":[{"value":3},{"value":6}]},{"children":[{"value":4},{"value":5}]}]},{"children":[{"children":[{"value":1},{"value":8}]},{"children":[{"value":2},{"value":7}]}]}]},
  },
  {
    file: "fig-order-best.svg",
    title: "Best possible move order: same answer, three leaves never looked at",
    mode: "alphabeta",
    tree: {"kind":"max","children":[{"children":[{"children":[{"value":7},{"value":2}]},{"children":[{"value":8},{"value":1}]}]},{"children":[{"children":[{"value":5},{"value":4}]},{"children":[{"value":6},{"value":3}]}]}]},
  },
];

const DEFAULT_TREE = {
  kind: "max",
  children: [
    { children: [{ value: 4 }, { value: 8 }] },
    { children: [{ value: 3 }, { value: 2 }] },
  ],
};

/* -------------------------------------------------------------------- text */

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Split caption HTML into words. A word is a run of non-space text and may mix
 * bold and plain parts, so trailing punctuation stays welded to the bold word
 * it follows ("<b>A</b>." is one word, not "A" and ".").
 */
function words(html) {
  const out = [];
  let cur = null;
  for (const chunk of html.split(/(<b>.*?<\/b>)/g)) {
    if (!chunk) continue;
    const bold = chunk.startsWith("<b>");
    const text = bold ? chunk.slice(3, -4) : chunk;
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        cur = null;
        continue;
      }
      if (!cur) out.push((cur = { parts: [] }));
      cur.parts.push({ text: piece, bold });
    }
  }
  return out;
}

// Rough advance width per character at 13px in a system sans stack. Only needs
// to be close enough that lines do not overflow the box.
const CHAR = 6.6;
const wordWidth = (word) =>
  word.parts.reduce((sum, p) => sum + p.text.length * CHAR * (p.bold ? 1.06 : 1), 0);

function wrap(html, maxWidth) {
  const lines = [];
  let line = [];
  let used = 0;
  for (const word of words(html)) {
    const adv = wordWidth(word) + CHAR;
    if (used + adv > maxWidth && line.length) {
      lines.push(line);
      line = [];
      used = 0;
    }
    line.push(word);
    used += adv;
  }
  if (line.length) lines.push(line);
  return lines;
}

const lineSvg = (line, x, y, cls) =>
  `<text class="${cls}" x="${x}" y="${y}" xml:space="preserve">` +
  line
    .map((word, i) =>
      word.parts
        .map(
          (part, j) =>
            `<tspan${part.bold ? ' class="b"' : ""}>` +
            `${esc((i && !j ? " " : "") + part.text)}</tspan>`,
        )
        .join(""),
    )
    .join("") +
  `</text>`;

/* -------------------------------------------------------------------- style */

const STYLE = `
  .bg    { fill: #ffffff; }
  .panel { fill: #f6f7f9; }
  .done  { fill: #ebedf0; }
  .line  { stroke: #c8cdd4; }
  .edge  { stroke: #1c1e21; stroke-width: 2; opacity: .5; fill: none; }
  .edge.pruned { stroke: #c8cdd4; stroke-width: 1.6; stroke-dasharray: 3 4; opacity: .7; }
  .box   { stroke-width: 1.8; }
  .max   { stroke: #c62828; }
  .min   { stroke: #1d4ed8; }
  .nega  { stroke: #a16207; }
  .leafbox { stroke: #c8cdd4; }
  .leafbox.pruned { stroke-dasharray: 3 4; opacity: .5; }
  .name  { font-size: 11px; }
  .name.max { fill: #c62828; }
  .name.min { fill: #1d4ed8; }
  .name.nega { fill: #a16207; }
  .val   { fill: #1c1e21; font-size: 15px; font-weight: 650; }
  .val.dim { fill: #9aa1ab; }
  .ab    { fill: #6b7280; font-size: 11px; }
  .title { fill: #1c1e21; font-size: 15px; font-weight: 650; }
  .head  { fill: #6b7280; font-size: 11px; letter-spacing: .08em; }
  .cap   { fill: #1c1e21; font-size: 13px; }
  .num   { fill: #6b7280; font-size: 12px; }
  .cut   { fill: #7c3aed; }
  .cut .b, .cut tspan { fill: #7c3aed; }
  .b     { font-weight: 650; }
  text   { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .mid   { text-anchor: middle; }

  @media (prefers-color-scheme: dark) {
    .bg    { fill: #14161a; }
    .panel { fill: #1b1e24; }
    .done  { fill: #24272e; }
    .line  { stroke: #333944; }
    .edge  { stroke: #e7e9ee; }
    .edge.pruned { stroke: #333944; }
    .max, .name.max { stroke: #f4796b; }
    .name.max { fill: #f4796b; }
    .min, .name.min { stroke: #7aa7f5; }
    .name.min { fill: #7aa7f5; }
    .nega, .name.nega { stroke: #fbbf24; }
    .name.nega { fill: #fbbf24; }
    .leafbox { stroke: #333944; }
    .val, .title { fill: #e7e9ee; }
    .val.dim { fill: #5c646f; }
    .ab, .head, .num { fill: #98a1af; }
    .cap   { fill: #e7e9ee; }
    .cut, .cut tspan { fill: #a78bfa; }
  }
`;

/* ------------------------------------------------------------------- render */

function renderFigure({ title, mode, tree, showAb = mode.endsWith("alphabeta") }) {
  const layout = prepare(tree ?? DEFAULT_TREE);
  if (mode.startsWith("negamax")) toNegamax(layout);
  const { nodes, byId, rootId, leafCount, maxDepth } = layout;
  const steps = buildTrace(byId, rootId, mode, alphabetaVisited(byId, rootId), showAb);
  const final = steps[steps.length - 1];
  const m = metrics(mode, showAb);

  const treeW = leafCount * H_GAP + PAD * 2;
  const W = Math.max(treeW, 560);
  const dx = (W - treeW) / 2; // centre a narrow tree in a wider page
  const titleH = 34;
  const treeH = maxDepth * m.vGap + Math.max(m.h, LEAF_H) + PAD;

  const body = [];
  const pos = (n) => ({
    x: dx + PAD + (n.slot + 0.5) * H_GAP,
    y: titleH + PAD + n.depth * m.vGap + m.h / 2,
  });
  const boxH = (n) => (n.kind === "leaf" ? LEAF_H : m.h);

  body.push(`<text class="title" x="${PAD}" y="${PAD}">${esc(title)}</text>`);

  for (const n of nodes) {
    if (!n.parent) continue;
    const p = pos(byId[n.parent]);
    const c = pos(n);
    const pruned = final.state[n.id].status === "pruned" ? " pruned" : "";
    body.push(
      `<path class="edge${pruned}" d="M ${p.x} ${p.y + boxH(byId[n.parent]) / 2} ` +
        `L ${c.x} ${c.y - boxH(n) / 2}"/>`,
    );
  }

  for (const n of nodes) {
    const { x, y } = pos(n);
    const s = final.state[n.id];
    const leaf = n.kind === "leaf";
    const w = leaf ? LEAF_W : m.w;
    const h = boxH(n);
    const pruned = s.status === "pruned";
    const fill = s.status === "done" ? "done" : "panel";
    const kindCls = mode.startsWith("negamax") ? "nega" : n.kind;
    const stroke = leaf ? `leafbox${pruned ? " pruned" : ""}` : kindCls;

    body.push(
      `<rect class="box ${fill} ${stroke}" x="${x - w / 2}" y="${y - h / 2}" ` +
        `width="${w}" height="${h}" rx="${leaf ? 7 : 9}"/>`,
    );
    if (!leaf) {
      body.push(
        `<text class="name mid ${kindCls}" x="${x}" y="${y + m.nameDy}" dominant-baseline="middle">` +
          `${esc(n.name)} ${n.kind === "max" ? "▲ max" : "▼ min"}</text>`,
      );
    }
    body.push(
      `<text class="val mid${pruned ? " dim" : ""}" x="${x}" y="${leaf ? y : y + m.valDy}" ` +
        `dominant-baseline="middle">${esc(nodeLabel(n, s))}</text>`,
    );
    const ab = m.abDy !== null && !leaf ? abLabel(s) : "";
    if (ab) {
      body.push(
        `<text class="ab mid" x="${x}" y="${y + m.abDy}" dominant-baseline="middle">${esc(ab)}</text>`,
      );
    }
  }

  // Commentary: every step of the walk, so the whole narrative is proofreadable.
  let y = titleH + treeH + 20;
  body.push(`<line class="line" x1="${PAD}" y1="${y - 18}" x2="${W - PAD}" y2="${y - 18}"/>`);
  body.push(`<text class="head" x="${PAD}" y="${y}">STEP BY STEP</text>`);
  y += 24;

  const numW = 26;
  const capX = PAD + numW;
  const capW = W - capX - PAD;

  steps.forEach((step, i) => {
    const lines = wrap(step.caption, capW);
    body.push(`<text class="num" x="${PAD}" y="${y}">${i + 1}.</text>`);
    for (const line of lines) {
      body.push(lineSvg(line, capX, y, `cap${step.cutoff ? " cut" : ""}`));
      y += 18;
    }
    y += 8;
  });

  const H = y + PAD - 8;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ` +
    `font-family="ui-sans-serif, system-ui, sans-serif">\n` +
    `<style>${STYLE}</style>\n` +
    `<rect class="bg" x="0" y="0" width="${W}" height="${H}" rx="10"/>\n` +
    `<rect class="bg line" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none"/>\n` +
    body.join("\n") +
    `\n</svg>\n`
  );
}

for (const fig of FIGURES) {
  const out = join(HERE, fig.file);
  writeFileSync(out, renderFigure(fig));
  console.log(`wrote ${fig.file}`);
}
