# Digital Life by SHIKAKERU

> **Save tokens. See your code.** AI-generated code health visualizer for the agent era.

## What is this?

An AI Agent Code Health Visualizer for VS Code. Your codebase spawns 3D fluffy creatures and voxel AI robot agents that react to your coding habits in real-time. File health, code smells, and agent activity are all visualized as a living digital ecosystem.

## Features

- **6 Species of 3D Fluffy Creatures** — Puff (Python), Blob (Go), Pip (Swift/Kotlin), Wisp (Vue/Svelte), Chomp (Rust/C/C++), Dot (TypeScript/JavaScript). Each species has unique colors and personality.
- **5 Voxel AI Robot Agents** — Claude, Cursor, Copilot, and Custom agent types. Add agents and watch them patrol your codebase.
- **File Health Visualization** — Line count, bug count, and last modified time displayed per creature. Code smells (TODO, console.log, `any` types) trigger visual warnings.
- **4 Prescription Actions** — Feed (nourish creatures), Diet (split large files), Cure (fix bugs), Wake (review old files). Click to activate, then click a creature to apply.
- **Coding DNA** — Your coding habits (commit frequency, night owl tendency, polyglot score, velocity, consistency) are analyzed and affect creature behavior.
- **Keyboard Agent Control** — Select an agent and move with WASD or Arrow keys.
- **3 Background Rooms** — Switch between Room 1, Room 2, and Room 3 with the Room button.
- **i18n** — English and Japanese language support.
- **Persistent** — Creatures and agents survive across sessions.
- **Sound Effects** — Audio feedback for feeding and interactions.

## Quick Start

1. Install from VS Code Marketplace (coming soon) or build from source
2. Open any project folder
3. Open the **Digital Life** panel (bottom panel)
4. Create a `.ts` or `.py` file — your first creature is born!
5. Name it and start caring

## Building from Source

```bash
git clone https://github.com/teamshikakeru-glitch/digital-life.git
cd digital-life
npm install
npm run build
```

Press **F5** in VS Code to launch the Extension Development Host.

## How It Works

| Your Action | World Effect |
|---|---|
| Create source file | New creature born (species based on file extension) |
| Edit code | Bug scan runs, file health updated |
| `git commit` | All creatures fed + golden sparkle effect |
| `// TODO` in code | Bugs appear, weather worsens |
| `console.log()` | Bugs appear |
| `: any` type | Bugs appear |
| Delete source file | Linked creature dies |

## Controls

| Action | How |
|---|---|
| Feed | Click Feed button, then click creature |
| Diet | Click Diet button, then click creature |
| Cure | Click Cure button, then click creature |
| Wake | Click Wake button, then click creature |
| Move agent | Select agent, then WASD or Arrow keys |
| Switch room | Click Room button |
| Select creature/agent | Click on it |
| Zoom | Pinch / Ctrl+scroll |
| Pan | Two-finger scroll / drag when zoomed |

## Species

| Species | File Types | Personality |
|---|---|---|
| Puff | `.py` | Fluffy and shy |
| Blob | `.go` | Slimy and chill |
| Pip | `.swift`, `.kt` | Curious and quick |
| Wisp | `.vue`, `.svelte` | Mysterious and quiet |
| Chomp | `.rs`, `.c`, `.cpp`, `.h` | Hungry and strong |
| Dot | `.ts`, `.tsx`, `.js`, `.jsx` | Dark and mysterious |

## Coding DNA

Your coding habits are analyzed into 5 DNA traits that affect creature behavior:

- **Commit Frequency** — How often you commit
- **Night Owl** — How much you code at night
- **Polyglot** — How many languages you use
- **Velocity** — How fast you code
- **Consistency** — How regular your coding pattern is

## Tech Stack

- TypeScript + Webpack
- VS Code Webview API
- Canvas 2D rendering
- chokidar (file watching)
- simple-git (commit detection)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - [SHIKAKERU Inc.](https://shikakeru.com)

---

Made with love by SHIKAKERU — AI-powered development studio from Fukui, Japan.
