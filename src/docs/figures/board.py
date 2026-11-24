"""Render the static chess boards used by the tutorial.

    uv run python figures/board.py

Both come out of python-chess's own board renderer, so the pieces figure and
the values figure line up square for square. Do not hand-edit the SVGs.
"""

import re
from pathlib import Path

import chess
import chess.svg

MATERIAL_FEN = "4r1k1/Rb3ppp/4p3/2B1P3/1p2P2P/5P2/1Pn3P1/6K1 b - - 0 29"

# AlphaZero - Stockfish 8, 2017, the "Immortal Zugzwang" game. Black is
# a piece up and can hardly move.
ZUGZWANG_FEN = "5rkq/2r2p1p/5RpP/2p3P1/2B5/p4Q2/P4PK1/8 w - - 0 1"
SIZE = 360
SQUARE = 45  # python-chess draws a square at this size, whatever `size` is
MARGIN = 15  # the coordinate border around the 8x8 grid

VALUES = {
    chess.KING: 0,
    chess.QUEEN: 9,
    chess.ROOK: 5,
    chess.BISHOP: 3,
    chess.KNIGHT: 3,
    chess.PAWN: 1,
}

USE_RE = re.compile(
    r'<use href="#(?P<color>white|black)-(?P<piece>\w+)"[^>]*?'
    r'transform="translate\((?P<x>[\d.]+), (?P<y>[\d.]+)\)" />'
)
PIECE_TYPES = {
    "king": chess.KING,
    "queen": chess.QUEEN,
    "rook": chess.ROOK,
    "bishop": chess.BISHOP,
    "knight": chess.KNIGHT,
    "pawn": chess.PAWN,
}


def value_label(match: re.Match[str]) -> str:
    value = VALUES[PIECE_TYPES[match["piece"]]]
    white = match["color"] == "white"
    text = "0" if value == 0 else (f"+{value}" if white else f"-{value}")
    fill, stroke = ("#ffffff", "#4a4a4a") if white else ("#262421", "#f2f2f2")
    x = float(match["x"]) + SQUARE / 2
    y = float(match["y"]) + SQUARE / 2
    return (
        f'<text x="{x:g}" y="{y:g}" text-anchor="middle" dominant-baseline="central"'
        f' font-family="Helvetica, Arial, sans-serif" font-size="21" font-weight="700"'
        f' fill="{fill}" stroke="{stroke}" stroke-width="1" paint-order="stroke">{text}</text>'
    )


# Piece-square tables, written the way you read a board: rank 8 first, from
# white's point of view. Values are the classic "simplified evaluation"
# numbers, in centipawns.
KNIGHT_PST = """
-50 -40 -30 -30 -30 -30 -40 -50
-40 -20   0   0   0   0 -20 -40
-30   0  10  15  15  10   0 -30
-30   5  15  20  20  15   5 -30
-30   0  15  20  20  15   0 -30
-30   5  10  15  15  10   5 -30
-40 -20   0   5   5   0 -20 -40
-50 -40 -30 -30 -30 -30 -40 -50
"""

KING_MIDDLEGAME_PST = """
-30 -40 -40 -50 -50 -40 -40 -30
-30 -40 -40 -50 -50 -40 -40 -30
-30 -40 -40 -50 -50 -40 -40 -30
-30 -40 -40 -50 -50 -40 -40 -30
-20 -30 -30 -40 -40 -30 -30 -20
-10 -20 -20 -20 -20 -20 -20 -10
 20  20   0   0   0   0  20  20
 20  30  10   0   0  10  30  20
"""

KING_ENDGAME_PST = """
-50 -40 -30 -20 -20 -30 -40 -50
-30 -20 -10   0   0 -10 -20 -30
-30 -10  20  30  30  20 -10 -30
-30 -10  30  40  40  30 -10 -30
-30 -10  30  40  40  30 -10 -30
-30 -10  20  30  30  20 -10 -30
-30 -30   0   0   0   0 -30 -30
-50 -30 -30 -30 -30 -30 -30 -50
"""


def heat(value: int, span: int) -> str:
    """A pale green tint for good squares, red for bad ones."""
    t = max(-1.0, min(1.0, value / span))
    good, bad, neutral = (0x4C, 0x9A, 0x5A), (0xC0, 0x4A, 0x3A), (0xEE, 0xE6, 0xD8)
    target = good if t >= 0 else bad
    k = abs(t) * 0.75
    rgb = tuple(round(n + (t2 - n) * k) for n, t2 in zip(neutral, target))
    return "#%02x%02x%02x" % rgb


def pst_svg(table: str, path: Path) -> None:
    """A board with one number per square, tinted by how good the square is."""
    values = [int(v) for v in table.split()]
    assert len(values) == 64, len(values)
    span = max(abs(v) for v in values)

    # The table reads rank 8 first; chess.SQUARES starts at a1.
    by_square = {
        chess.square(file, 7 - row): values[row * 8 + file]
        for row in range(8)
        for file in range(8)
    }

    svg = chess.svg.board(
        chess.Board(None),
        size=SIZE,
        fill={sq: heat(v, span) for sq, v in by_square.items()},
    )

    labels = []
    for square, value in by_square.items():
        x = MARGIN + chess.square_file(square) * SQUARE + SQUARE / 2
        y = MARGIN + (7 - chess.square_rank(square)) * SQUARE + SQUARE / 2
        labels.append(
            f'<text x="{x:g}" y="{y:g}" text-anchor="middle" dominant-baseline="central"'
            f' font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="600"'
            f' fill="#1c1e21">{value if value == 0 else f'{value:+d}'}</text>'
        )

    path.write_text(svg.replace("</svg>", "".join(labels) + "</svg>"))


def main() -> None:
    here = Path(__file__).parent
    board = chess.Board(MATERIAL_FEN)

    pieces = chess.svg.board(board, size=SIZE)
    (here / "fig-material-pieces.svg").write_text(pieces)

    values, replaced = USE_RE.subn(value_label, pieces)
    assert replaced == len(board.piece_map()), (replaced, len(board.piece_map()))
    values = re.sub(r"<defs>.*?</defs>", "", values, flags=re.S)
    (here / "fig-material-values.svg").write_text(values)

    chess.svg.board(chess.Board(), size=SIZE)
    (here / "fig-startpos.svg").write_text(chess.svg.board(chess.Board(), size=SIZE))

    (here / "fig-zugzwang.svg").write_text(
        chess.svg.board(chess.Board(ZUGZWANG_FEN), size=SIZE)
    )

    pst_svg(KNIGHT_PST, here / "fig-pst-knight.svg")
    pst_svg(KING_MIDDLEGAME_PST, here / "fig-pst-king-middlegame.svg")
    pst_svg(KING_ENDGAME_PST, here / "fig-pst-king-endgame.svg")

    white = sum(VALUES[p.piece_type] for p in board.piece_map().values() if p.color)
    black = sum(VALUES[p.piece_type] for p in board.piece_map().values() if not p.color)
    print(f"white {white}, black {black}, evaluate() -> {white - black}")


if __name__ == "__main__":
    main()
