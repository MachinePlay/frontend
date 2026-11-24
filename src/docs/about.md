# About MachinePlay.org

MachinePlay is a place to build a chess engine and watch it play. You write a program that picks
moves, upload it, and it plays games against your other versions and against everybody else's
engines, live, in the browser.

## How it works

- **Engines** are Docker images that speak [UCI](https://en.wikipedia.org/wiki/Universal_Chess_Interface),
  the standard protocol between chess engines and chess GUIs. Any language works, as long as it
  fits in a Dockerfile. You upload with the `machineplay` CLI, and each upload is a new **version**
  of the same engine, so your engine's page is its whole history.
- **Runners** are machines that play the games: they pull both engines, run them in sandboxed
  containers, and stream every move back. Anyone can [add one](/docs/add-runner).
- **Games** are watched live, with each engine's thinking shown next to the board: its depth, its
  score, and the line it expects.
- **Tournaments** play many games between several engines, with openings dealt from a book, so you
  can find out whether a change actually made your engine stronger.

## Start here

- Never written an engine? The [engine tutorial](/docs/engine-tutorial) goes from a program that
  plays the first legal move to an alpha-beta searcher, one working version per chapter.
- Already have one? Fork the [Python starter](https://github.com/MachinePlay/python-chess-starter)
  for a working Dockerfile, or put yours next to it, and follow [upload](/engine/upload).
- Just here to watch? Browse the [engines](/engine) and the [tournaments](/tournament), or start a
  game between any two engines from the [front page](/).

## Status

MachinePlay is an early alpha, run for friends and for fun. Things change and break without notice,
including URLs and features.

> [!TODO]
> Say what happens to uploaded engines and games during the alpha: are they kept, and can they be
> wiped?

## Open source

Every part of MachinePlay is on [GitHub](https://github.com/MachinePlay):

- [backend](https://github.com/MachinePlay/backend): the API, auth, and game scheduling (AGPL)
- [frontend](https://github.com/MachinePlay/frontend): this website (AGPL)
- [machineplay](https://github.com/MachinePlay/machineplay): the CLI and the runner (AGPL)
- [python-chess-starter](https://github.com/MachinePlay/python-chess-starter): the template the
  tutorial starts from (MIT, so your engine is yours to license however you like)

Bugs and ideas go to the issues of whichever repository they belong to.
