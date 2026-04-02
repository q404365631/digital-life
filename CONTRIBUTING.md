# Contributing to Digital Life

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/shikakeru/digital-life.git
cd digital-life
npm install
npm run watch  # Development mode
```

Press **F5** in VS Code to launch the extension in development mode.

## Project Structure

```
src/
├── extension.ts          # Extension entry point
├── types.ts              # Type definitions
├── constants.ts          # Game constants
├── creature/             # Creature state & management
├── monitor/              # File & git watchers
├── storage/              # Persistence
├── world/                # World state & tile map
└── ui/
    ├── PanelProvider.ts  # VS Code webview provider
    └── webview/          # Frontend (Canvas game)
        ├── main.ts       # Game loop & input handling
        ├── renderer/     # Tile, sprite, UI renderers
        └── sprites/      # Pixel art sprite data
```

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Build and test (`npm run build`)
5. Commit (`git commit -m 'feat: add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Tests
- `chore:` Maintenance

## Adding New Sprites

Sprites are defined as 2D arrays in `src/ui/webview/sprites/`. Each number is a palette index.
See `PuffSprites.ts` for the creature sprite format (16x16).

## Code Style

- TypeScript strict mode
- Immutable data patterns (spread operator, no mutation)
- No `any` types
- No `console.log` in production code

## Questions?

Open an issue or reach out to the maintainers.
