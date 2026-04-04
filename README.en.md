# Digital Life

**Your code is alive.**

<!-- TODO: Place demo GIF/video here -->
<!-- ![Digital Life Demo](assets/demo.gif) -->

---

## Your Code Has a Life of Its Own

We've always treated code as text files.
But code has health. It grows. It ages. It decays.

Digital Life makes that invisible life visible.

Creatures are born from the files you write.
When your code is healthy, they walk around happily.
When bugs pile up, they look sad.

This is not a tool.
**It's a new relationship with your code.**

---

## Why Creatures?

Dashboards deliver information, but not emotion.

"Bug count: 12" doesn't move anyone.
But when a creature you named is visibly suffering—
you naturally want to fix the code.

**Converting human empathy into an interface.**
That is the design philosophy of Digital Life.

In the age of AI agents writing code,
the line between human-written and AI-written code is blurring.
That's exactly why we need a new interface that lets you
*feel* code health, not just read it.

---

## How the World Works

| Your Action | What Happens |
|---|---|
| Create a source file | A creature hatches from an egg |
| Save code | Health check runs, sparkle effect |
| `git commit` | All creatures are nourished, golden light rains down |
| Leave `// TODO` | Skies darken, creatures grow anxious |
| Leave `console.log()` or `: any` | Bugs increase, creature health worsens |
| Delete a file | The creature dissolves into particles of light |

---

## 6 Species

Different species are born based on file extensions.
Each has unique colors, voice, and personality.

| Species | Files | Personality |
|---|---|---|
| **Puff** | `.py` | Fluffy and shy |
| **Blob** | `.go` | Laid-back and calm |
| **Pip** | `.swift` `.kt` | Curious and quick |
| **Wisp** | `.vue` `.svelte` | Mysterious and quiet |
| **Chomp** | `.rs` `.c` `.cpp` `.h` | Hungry and tough |
| **Dot** | `.ts` `.tsx` `.js` `.jsx` | Cool and intelligent |

Custom species mapping is available via `.digital-life.json`.

---

## Caring for Creatures

Click a creature to have AI diagnose its file's health
and suggest a specific prescription.

| Prescription | What It Does | Triggered When |
|---|---|---|
| **Feed** | Nourish the creature | Anytime |
| **Cure** | Fix bugs | Bugs detected |
| **Diet** | Split large files | File exceeds 400 lines |
| **Untangle** | Reduce nesting depth | Nesting deeper than 4 levels |
| **Split** | Break apart long functions | Function exceeds 50 lines |
| **Wake** | Review stale files | No updates for 7+ days |

Approve the prescription and an AI agent executes it in the terminal.

---

## Coexisting with AI Agents

Summon AI agents into your world as voxel robots.

- **3 agent types** — Claude, Cursor, Copilot
- Add with the **+ Agent** button, click to switch between them
- Select an agent and move it with **Arrow keys / WASD**, or press **Space** to sit
- Drag to reposition directly

**Humans and AI, sharing the same space.**
We believe that's what the future of development looks like.

---

## Personality (Coding DNA)

Your git history is analyzed into 5 DNA traits
that shape creature behavior and dialogue:

| Trait | Meaning |
|---|---|
| **Active** | Commit frequency and speed |
| **Night Owl** | Late-night coding tendency |
| **Curious** | Language diversity |
| **Swift** | Coding velocity |
| **Steady** | Regularity of habits |

Your DNA creates an ecosystem that is uniquely yours.

---

## Weather & Time

Real-world weather and time of day are reflected in the world.

- Rain outside means rain in your world, with drifting clouds
- Night falls, the sky darkens
- More bugs worsen the weather

Your code's world is connected to your reality.

---

## Toolbar

| Button | Function |
|---|---|
| 🍞 **Feed** | Activate feed mode |
| 🩺 **Care** | AI diagnosis → suggest prescription |
| **+ Agent** | Add an AI agent to the world |
| 🔄 | Switch between agents |
| 📷 | Save a screenshot |
| **EN** | Cycle language (6 supported) |
| 🔊 / 🔇 | Toggle sound on/off |

---

## Controls

| Action | How |
|---|---|
| Select creature | Click (also opens file in editor) |
| Move creature | Drag |
| Feed | 🍞 → click creature |
| Care | 🩺 → click creature → approve prescription |
| Move agent | Select → Arrow keys / WASD |
| Sit agent | Select → Space |
| Zoom | Mouse wheel / pinch |
| Pan | Right-click drag / two-finger scroll |
| Reset zoom | Double-click |

---

## Settings

Available in VS Code settings (`Ctrl+,`):

| Setting | Description | Default |
|---|---|---|
| `digitalLife.realWeather` | Reflect real-world weather | `true` |
| `digitalLife.language` | UI language (auto follows VS Code) | `auto` |
| `digitalLife.sound` | Enable sound effects | `true` |
| `digitalLife.saveReaction` | Sparkle effect on file save | `true` |

---

## Supported Languages

English · 日本語 · 繁體中文 · 简体中文 · 한국어 · Español

---

## Getting Started

```bash
git clone https://github.com/teamshikakeru-glitch/digital-life.git
cd digital-life
npm install
npm run build
```

Press **F5** in VS Code to launch the Extension Development Host.
The **DIGITAL LIFE** tab appears in the bottom panel.

Create a source file. Your first creature will be born.

---

## Tech Stack

- TypeScript + Webpack
- VS Code Webview API
- Canvas 2D rendering (pixel art style)
- chokidar (file watching)
- simple-git (commit detection & DNA analysis)
- Open-Meteo API (weather) · ipinfo.io (geolocation)

*No API key required. No personal data stored.*

---

## License

MIT — [SHIKAKERU Inc.](https://shikakeru.com)

---

<p align="center">
  <strong>Code is not text. It's alive.</strong>
</p>

<p align="center">
  Made by <a href="https://shikakeru.com">SHIKAKERU</a> — Fukui, Japan
</p>
