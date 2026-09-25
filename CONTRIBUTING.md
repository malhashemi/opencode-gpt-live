# Contributing

Thanks for helping. Bug reports, platform testing, prompt improvements and code are all welcome.

## Where to start

- **Found a bug?** [Open a bug report](https://github.com/malhashemi/opencode-gpt-live/issues/new?template=bug.yml).
  Include your OS, terminal and the call log from `~/.local/state/opencode-gpt-live/calls/`; it shows exactly what
  happened during the call.
- **On Linux or Windows?** Most development happens on macOS. A report that calls, echo cancellation or ducking work
  (or don't) on your setup is a real contribution.
- **Have an idea?** [Open a feature request](https://github.com/malhashemi/opencode-gpt-live/issues/new?template=feature.yml)
  before writing a lot of code, so we can agree on the shape first.
- **Security issue?** Follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development

The [development guide](docs/development.md) covers setup, running the plugin from your checkout, testing calls without
a microphone and the release process. The [architecture guide](docs/architecture.md) explains how the pieces fit.

The short version:

```sh
bun install
bun run build:native   # the audio helper, needs Rust 1.91+
bun run check          # formatting, lint, types, tests
```

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests where it makes sense: `test/` covers the pure logic (prompts, aura rendering, key
   parsing, the herdr protocol, GPT-Live message parsing).
3. Run `bun run check`. For helper changes, also run `cargo fmt`, `cargo clippy -- -D warnings` and `cargo test` in
   `native/`.
4. Try it in a real call when your change affects calls or the UI, and say in the pull request what you tested and on
   which platform.
5. Open the pull request with a [Conventional Commit](https://www.conventionalcommits.org/) title.

`main` only changes through pull requests, and CI must pass before anything merges. CI on a pull request from someone
who has not had a contribution merged yet starts once a maintainer approves the run. A maintainer reviews and merges
outside contributions; maintainers merge their own pull requests once CI passes.

### Commit and pull request titles

Titles drive the changelog and version numbers, so they follow Conventional Commits:

| Prefix      | Use for                              | Release effect           |
| ----------- | ------------------------------------ | ------------------------ |
| `feat:`     | A new capability users will notice   | Minor version, changelog |
| `fix:`      | A bug fix                            | Patch version, changelog |
| `perf:`     | A performance improvement            | Patch version, changelog |
| `docs:`     | Documentation only                   | None                     |
| `refactor:` | Code changes with no behavior change | None                     |
| `test:`     | Tests only                           | None                     |
| `build:`    | Dependencies, tooling, packaging     | None                     |
| `ci:`       | Workflows                            | None                     |
| `chore:`    | Anything else                        | None                     |

Add `!` after the type (`feat!:`) for a breaking change, and describe the migration in the pull request body.

### Code style

- TypeScript is formatted with [oxfmt](https://oxc.rs/docs/guide/usage/formatter) and linted with
  [oxlint](https://oxc.rs/docs/guide/usage/linter); CI rejects warnings. Fix findings in the code rather than disabling
  rules; a targeted `oxlint-disable-next-line` needs a comment explaining why.
- Rust is formatted with `cargo fmt` and linted with `cargo clippy -- -D warnings`.
- Only `tui.ts` may import `@opentui/core` at runtime; everywhere else, use type-only imports and `core()`. The
  [architecture guide](docs/architecture.md#the-terminal-ui) explains why.
- Comments explain why something is done, not what the next line does.

### Improving the prompts

The prompts in [`src/server/prompts/`](src/server/prompts) shape how the voice behaves, and they are plain Markdown.
See the [prompts README](src/server/prompts/README.md) for how they are assembled. Prompt changes are reviewed like code:
describe the behavior you saw, the change and how it behaved afterwards.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind and assume good intent.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
