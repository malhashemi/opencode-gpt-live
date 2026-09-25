# Development guide

Everything you need to change the plugin, run it from a checkout and test calls.

## Prerequisites

| Tool                                       | Why                                            |
| ------------------------------------------ | ---------------------------------------------- |
| [Bun](https://bun.sh) 1.3+                 | Installs dependencies, runs tests and scripts. |
| [OpenCode](https://opencode.ai) 2.0.14+    | Runs the plugin.                               |
| [Rust](https://rustup.rs) 1.91+            | Builds the audio helper.                       |
| CMake and a C compiler                     | Build libopus and ring for the helper.         |
| Linux only: `libasound2-dev`, `pkg-config` | ALSA headers for audio.                        |
| A ChatGPT sign-in in OpenCode              | Real calls. Tests and the UI work without one. |

## Setup

```sh
git clone https://github.com/malhashemi/opencode-gpt-live
cd opencode-gpt-live
bun install
bun run build:native
```

`bun run build:native` writes `native/target/release/gpt-live-host`, which the plugin finds automatically when it runs
from the checkout.

## Running the plugin from your checkout

Link the checkout into a test project's plugin directory; OpenCode loads plugins in `.opencode/plugins/` on start:

```sh
mkdir -p ~/scratch/voice-test/.opencode/plugins
ln -s "$PWD" ~/scratch/voice-test/.opencode/plugins/gpt-live
cd ~/scratch/voice-test && opencode
```

Then run `/voice`.

- **Server plugin changes** (`src/server`, `src/shared`) reload on save. Reloading ends an active call.
- **Terminal plugin changes** (`src/tui`, `tui.ts`) need an OpenCode restart.
- **Helper changes** need `bun run build:native`, then a new call.

## Checks

```sh
bun run check      # oxfmt --check, oxlint, tsc, bun test
bun run format     # format with oxfmt
bun run lint:fix   # apply oxlint's automatic fixes

cargo fmt --manifest-path native/Cargo.toml
cargo clippy --manifest-path native/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path native/Cargo.toml
```

oxfmt leaves the prompt section folders (`src/server/prompts/gpt-live`, `src/server/prompts/voice-agent`) alone:
reformatting them would change the text the models read.

CI runs all of these, lints the helper on macOS, Linux and Windows, and builds it for every release platform.

## Developer switches

Environment variables for testing. They are not user settings.

| Variable              | Effect                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `GPT_LIVE_INPUT_FILE` | Use a WAV file as the microphone. It plays once, then silence.                                         |
| `GPT_LIVE_OUTPUT`     | `none` discards GPT-Live's audio; a path writes it to a WAV file.                                      |
| `GPT_LIVE_AUTOSTART`  | Start a call as soon as a session is open.                                                             |
| `GPT_LIVE_DEBUG`      | Path to a JSONL file for UI diagnostics: which aura surface was picked, terminal capabilities, errors. |
| `GPT_LIVE_VISUAL`     | Force the aura surface: `kitty`, `herdr` or `blocks`.                                                  |
| `GPT_LIVE_HOST`       | Path to a `gpt-live-host` binary to use instead of the usual lookup.                                   |

A hands-free test run: a recorded question as the microphone, no speaker, the call starting on its own:

```sh
say -o /tmp/question.aiff "What does this project do?"          # macOS; any 16-bit WAV works
ffmpeg -y -i /tmp/question.aiff -ar 48000 -ac 1 /tmp/question.wav
GPT_LIVE_INPUT_FILE=/tmp/question.wav GPT_LIVE_OUTPUT=none GPT_LIVE_AUTOSTART=1 opencode
```

### Headless end-to-end call

`scripts/e2e-call.ts` places a real call without the terminal UI: it starts the helper, creates the call through the
server plugin and prints the transcript. The project directory must load the plugin (for example through the symlink
above).

```sh
bun run e2e ~/scratch/voice-test --speak "What does this project do?"
bun run e2e ~/scratch/voice-test --devices     # real microphone and speaker
```

### Call logs

With logging on, each call writes `~/.local/state/opencode-gpt-live/calls/<time>-<callID>.jsonl`: transcripts,
hand-offs, tool calls and errors. It is the first place to look when a call misbehaves.

## Working on the aura

`scripts/render-aura.ts` renders `assets/aura.webp` for the README with the real renderer. Run it after changing
`src/tui/aura.ts` (requires ImageMagick):

```sh
bun scripts/render-aura.ts
```

In the terminal, `GPT_LIVE_VISUAL=blocks` shows the half-block fallback in any terminal, and `GPT_LIVE_DEBUG` records
which surface was chosen and why.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Merge pull requests with [Conventional Commit](https://www.conventionalcommits.org/) titles (`feat:`, `fix:`,
   `docs:` and so on). `feat` bumps the minor version, `fix` the patch version.
2. release-please keeps a release pull request open with the next version and the changelog entry. Edit its
   `CHANGELOG.md` if the wording needs polish. GitHub does not run CI for pull requests opened by GitHub Actions, so
   the release workflow starts CI on that branch itself; its checks appear on the release pull request like any other.
3. Merging the release pull request tags the release. The release workflow then builds the helper for every platform,
   attaches the binaries and `SHA256SUMS` to the GitHub release, and publishes to npm:
   - `opencode-gpt-live-<platform>-<arch>`: one package per platform, carrying the helper.
   - `opencode-gpt-live`: the plugin, with the platform packages as optional dependencies.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers): each package trusts
`release.yml` in the `npm` environment of this repository, so no npm token exists anywhere, and every version carries
a provenance attestation linking it to the workflow run that built it.

### Supported platforms

Defined in `scripts/targets.ts` and `.github/workflows/build-helper.yml`:

| Target         | Runner                      |
| -------------- | --------------------------- |
| `darwin-arm64` | `macos-15`                  |
| `darwin-x64`   | `macos-15` (cross-compiled) |
| `linux-x64`    | `ubuntu-22.04`              |
| `linux-arm64`  | `ubuntu-22.04-arm`          |
| `win32-x64`    | `windows-2022`              |

Adding a platform means adding it to both files; `test/targets.test.ts` checks that package names match what the
plugin looks for at runtime.
