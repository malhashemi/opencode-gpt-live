# Changelog

## [0.1.3](https://github.com/malhashemi/opencode-gpt-live/compare/v0.1.2...v0.1.3) (2026-09-26)


### Bug fixes

* report failed voice handoffs and clarify access ([#16](https://github.com/malhashemi/opencode-gpt-live/issues/16)) ([8b94eb4](https://github.com/malhashemi/opencode-gpt-live/commit/8b94eb4eb0a478a0d2563eba37b9f281523f6a7f))

## [0.1.2](https://github.com/malhashemi/opencode-gpt-live/compare/v0.1.1...v0.1.2) (2026-09-24)


### Bug fixes

* **tui:** keep the voice UI drawing when the theme lacks some hues ([#18](https://github.com/malhashemi/opencode-gpt-live/issues/18)) ([aa77cf5](https://github.com/malhashemi/opencode-gpt-live/commit/aa77cf517e37ce4eb8ab63d039de685f0c954c7e))

## [0.1.1](https://github.com/malhashemi/opencode-gpt-live/compare/v0.1.0...v0.1.1) (2026-09-24)


### Bug fixes

* **tui:** draw the kitty aura over the panel without flashing a see-through square ([#14](https://github.com/malhashemi/opencode-gpt-live/issues/14)) ([bf83a5a](https://github.com/malhashemi/opencode-gpt-live/commit/bf83a5a4f64fc6d5fac703110ef4afa1e3b4ca1d))

## 0.1.0 (2026-09-23)

The first release: real-time voice calls with OpenCode through GPT-Live, on your ChatGPT subscription.

### Features

* **Voice calls.** Run `/voice` or press `ctrl+x v` to talk to OpenCode. GPT-Live listens and replies in real time; say "end the call" to hang up. Calls start from anywhere, in a new session if none is open.
* **Your session does the work.** Requests go to the OpenCode session on screen. Ask for progress, redirect work mid-task, stop it, and answer its permission prompts, all by voice. You can keep typing in the same session during a call.
* **Continuity.** Each session keeps one voice conversation across calls, so the next call remembers the last; `/voice-new` starts fresh.
* **The aura.** A glowing ring that swells with the voice, cyan while you speak and violet while GPT-Live speaks. It is drawn as an image in terminals with kitty graphics (up to 60 fps), through herdr's graphics API inside herdr, and with half-block characters everywhere else.
* **Transcript panel** with every task sent to your session, a status strip with the call keys, and a footer badge.
* **Hands-free audio.** A native helper handles WebRTC, echo cancellation, noise suppression and Opus, prebuilt for macOS (arm64, x64), Linux (x64, arm64) and Windows (x64). Other apps' audio is turned down during calls and restored afterwards.
* **Configurable.** Voice, keys (`ctrl+y` mute and `ctrl+s` transcript by default), the transcript panel, audio ducking, and the system prompts: both are folders of Markdown sections that you can extend or replace with your own.
* **Reliable calls.** A call whose window closes or crashes ends automatically, and starting a call while an old one lingers takes it over.
