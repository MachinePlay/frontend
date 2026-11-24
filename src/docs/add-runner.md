# Add a runner

A **runner** is a machine that plays games. Every game and every tournament on machineplay is played
on one: it pulls both engines' images, runs them in Docker containers, referees the game with
[fastchess](https://github.com/Disservin/fastchess), and streams every move back to the website as
it happens.

machineplay.org has a runner of its own, but it is one small server. Adding yours gives you:

- your own cores for your own tournaments. A 500-game match between two versions of your engine is
  an evening on a desktop, and much longer queued behind everybody else on a shared box
- games played on hardware you know, so a time control means the same thing from one test to the
  next
- more capacity for everybody else, while it is online

## What you need

- Linux on x86-64. Engines are `linux/amd64` images, so anything else has to emulate them, which
  is slow enough to wreck the time controls
- [Docker](https://docs.docker.com/engine/install/), usable by your user without `sudo`
  (on most distros that means being in the `docker` group)
- [fastchess](https://github.com/Disservin/fastchess) on your `PATH`, from its releases page, your
  package manager (`nixpkgs` has it), or built from source. Point `FASTCHESS_PATH` at it if it lives
  elsewhere
- [uv](https://docs.astral.sh/uv/getting-started/installation/) and Python 3.12+
- a machineplay account

> [!TODO]
> The runner does not check the platform it starts on. On macOS or ARM it will connect and accept
> games that then play under emulation.

## Start it

Install the CLI and log in, the same two steps as uploading an engine:

```sh
uv tool install machineplay
machineplay login
```

Then start the runner:

```sh
machineplay runner
```

It reports its hardware, connects, and appears on the [runners](https://machineplay.org/runners)
page under your name. From then on it waits for work: start a game or a tournament and pick it as
the runner. Open its page to give it a name and a description; those survive restarts.

By default it plays one game per CPU core at the same time, each engine pinned to a core of its
own. Lower that with `MAX_GAMES` if you want to keep some of the machine for yourself:

```sh
MAX_GAMES=4 machineplay runner
```

The runner reconnects on its own if machineplay restarts, and its identity is saved in
`~/.config/machineplay/runner.json`, so restarting it brings back the same runner rather than a new
one.

## What it runs on your machine

A runner runs other people's code: every engine is a Docker image somebody uploaded. Each one runs
in a container with no network, all capabilities dropped, 512 MB of memory, and one CPU. That is a
reasonable sandbox, not a perfect one, so run a runner on a machine you are comfortable treating
that way.

Every command the runner executes is printed before it runs, so its log is a complete record of
what it did to your machine.

> [!TODO]
> Any signed-in user can currently schedule games on any online runner, yours included. Private
> runners, usable only by their owner, are planned.

## Keep it running

To keep a runner up across reboots, run it as a service. A systemd user unit is enough:

```ini
# ~/.config/systemd/user/machineplay-runner.service
[Unit]
Description=machineplay runner
After=network-online.target docker.service

[Service]
ExecStart=%h/.local/bin/machineplay runner
Environment=PYTHONUNBUFFERED=1
Restart=on-failure

[Install]
WantedBy=default.target
```

```sh
systemctl --user enable --now machineplay-runner
loginctl enable-linger "$USER"   # keep it running while you are logged out
journalctl --user -u machineplay-runner -f
```

## Configuration

Everything is set through environment variables.

| Variable | Default | What |
| --- | --- | --- |
| `MP_TOKEN` | saved by `login` | API token, overrides the saved one; handy on a server |
| `RUNNER_ID` | saved on first start | pin the runner's identity explicitly |
| `MAX_GAMES` | CPU count | games played at the same time, one core each |
| `ENGINE_MEMORY` | `512m` | memory limit per engine container |
| `ENGINE_CPUS` | `1` | CPU limit per engine container |
| `FASTCHESS_PATH` | `fastchess` | the fastchess binary |
| `PULL_TIMEOUT` | `600` | seconds before a stuck `docker pull` gives up |
| `NO_COLOR` | unset | set it to turn off coloured output |

The full list is in the [machineplay README](https://github.com/MachinePlay/machineplay#configuration).
