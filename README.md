# Digital Life by SHIKAKERU

> Soot sprites live in your VS Code. Code creates life. Care for them.

## What is this?

A VS Code extension that spawns tiny digital creatures (soot sprite style) in your editor.
Create source files and creatures are born. Write code and they react. Commit and they feast. Bugs in your code and weather turns dark.

Your coding habits shape their world.

## Features

- **Creatures born from code** — Every new source file (.ts, .js, .py, .go, etc.) spawns a soot sprite creature
- **Coding-reactive world** — Commits feed all creatures, TODO/console.log/any types summon bugs and storms
- **Care system** — Drag bread to feed, tap heart to pet, watch them react with hearts and sparkles
- **Pixel art world** — Hand-crafted 16x16 soot sprite creatures on a lush tile map
- **Persistent** — Creatures survive across sessions
- **Zoom & pan** — Explore the world with trackpad/mouse zoom and pan

## Quick Start

1. Install from VS Code Marketplace (coming soon) or build from source
2. Open any project folder
3. Open the **Digital Life** panel (bottom panel)
4. Create a `.ts` or `.js` file — your first creature is born!
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
| Create source file | New creature born |
| Edit code | Bug scan runs |
| `git commit` | All creatures fed + golden sparkle effect |
| `// TODO` in code | Bugs appear, weather worsens |
| `console.log()` | Bugs appear |
| `: any` type | Bugs appear |
| Delete source file | Linked creature dies |

## Controls

| Action | How |
|---|---|
| Feed | Drag bread onto creature (or click bread) |
| Pet | Click heart button |
| Select creature | Click on it |
| Zoom | Pinch / Ctrl+scroll |
| Pan | Two-finger scroll / drag when zoomed |
| Reset zoom | Double-click |

## Creature Stats

- **Hunger** (0-100) — Decays over time, restored by feeding
- **Happiness** (0-100) — Decays over time, restored by petting
- **Mood** — Happy / Neutral / Sad based on stats

## Tech Stack

- TypeScript + Webpack
- VS Code Webview API
- Canvas 2D pixel art rendering
- chokidar (file watching)
- simple-git (commit detection)

## Roadmap

- [ ] Multiple species (CodeBug, BitSlime, LogicFox, FrameGhost, DataDragon)
- [ ] Evolution system (light/dark paths based on coding habits)
- [ ] Breeding & genetics
- [ ] Environment evolution (glass jar to terrarium to office to vast space)
- [ ] Plaything elements (night logs, secret conversations, name resistance)
- [ ] VS Code Marketplace publish

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - [SHIKAKERU Inc.](https://shikakeru.com)

---

Made with love by SHIKAKERU — AI-powered development studio from Fukui, Japan.
