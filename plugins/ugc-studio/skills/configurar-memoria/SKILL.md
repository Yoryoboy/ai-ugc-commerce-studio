---
name: configurar-memoria
description: Install and configure Engram, the persistent memory, so Claude remembers decisions, preferences and what worked across conversations — install the engram program, register it in Claude Code (and Claude Desktop on Mac) with the fixed project "memory", and add the memory instructions to the user's CLAUDE.md (in $CLAUDE_CONFIG_DIR or ~/.claude) without removing anything they already have. Use when the user asks to activate, install, set up, check or repair the memory (memoria, Engram), or when the setup skill reaches its memory step.
---

# Set up the persistent memory (Engram)

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). Never show
them commands, JSON or file paths unless they ask; say in one line what each step does.

The steps are in `${CLAUDE_PLUGIN_ROOT}/references/engram.md`. Read it and follow it in order,
exactly as written. It is the same guide an agent reads from GitHub when it sets up a new
computer, so do not improvise another method.

Rules on top of the guide:

- **Already installed:** if `engram` exists and the `engram` MCP is registered with
  `ENGRAM_PROJECT=memory`, only verify (steps 1, 2 and 5) and tell the user the memory is already
  on. Do not reinstall or rewrite anything.
- **Linux:** skip step 3 (Claude Desktop has no Linux version).
- **The user's CLAUDE.md is theirs:** it lives in `$CLAUDE_CONFIG_DIR` when that variable is set,
  otherwise in `~/.claude`. Follow step 4 of the guide exactly: back up first, never delete or
  rewrite existing text, and when the file already has instructions, show them and let the user
  decide how to merge before writing anything. Back up the Claude Desktop config too.
- **Installing software** changes the computer: tell the user what you are going to install, in
  one line, before doing it.
- If a step fails, stop, say what failed in plain words and what the user can do. Do not report
  the memory as working until the final check passes.

## Close

Tell the user, in a few lines:

- the memory is installed (version);
- they must start a new session (and, on Mac, quit Claude Desktop with Cmd+Q and open it again)
  for it to work;
- how to check it afterwards: ask "¿qué proyecto de memoria detectás?"; Claude should answer
  `memory`.
