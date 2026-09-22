# Codex Weekly Status

[Português](README.md) · **English**

See your Codex usage limits right below the message box in your terminal.

![Codex showing 49% of the weekly limit remaining](assets/terminal.png)

`weekly 49% left` means **49% of your weekly allowance is still available**. It updates automatically; checking the balance does not use your allowance.

If your account also has a **5-hour limit**, it appears as `5h`. Accounts with only a weekly limit still show just `weekly`.

## Install

Works on **Windows, macOS, and Linux**. You need:

- Codex in your terminal, signed in with a ChatGPT account that has usage limits.
- Node.js 20+ and Git installed.

Copy these commands into your terminal:

```sh
git clone https://github.com/08Ryanxp/codex-weekly-status.git
cd codex-weekly-status
node setup.mjs
```

Close and reopen Codex to see the indicator. To continue an existing conversation, use `codex resume`.

Your other settings are preserved.

**Already installed?** From the project folder, run `git pull`, then `node setup.mjs` to update.

## Remove

From the `codex-weekly-status` folder, run:

```sh
node setup.mjs --remove
```

Reopen Codex. This removes only the limit indicators.

**Not showing up?** Check whether your limits appear in `/status` and try widening your terminal.

Community project · [MIT License](LICENSE)
