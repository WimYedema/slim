# Contributing to Slim

Thanks for your interest in contributing! Slim is a small, focused tool -- contributions that align with the [product guide](docs/PRODUCT-GUIDE.md) are welcome.

## Development setup

```sh
git clone git@github.com:WimYedema/slim.git
cd slim
npm install
npm run dev
```

## Before submitting a PR

```sh
npm run lint       # biome -- must pass with 0 errors
npm run check      # svelte-check + tsc -- must pass with 0 errors
npm run test       # vitest -- all tests must pass
npm run build      # single-file build must succeed
```

CI runs all four checks on every push and PR.

## Code style

- **Svelte 5 runes only** -- `$state`, `$derived`, `$effect`. No legacy `$:` or stores.
- **TypeScript strict** -- no `any`, no `@ts-ignore`.
- **Biome** handles formatting and linting -- run `npm run lint:fix` to auto-format.
- **kebab-case.ts** for lib files, **PascalCase.svelte** for components.
- See [copilot-instructions.md](.github/copilot-instructions.md) for full conventions.

## Architecture

All state lives in `App.svelte` as `$state` fields. Components receive state via props and emit changes via callbacks. No external state library.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Reporting issues

Open an issue on GitHub. Include:
- What you expected to happen
- What actually happened
- Browser and OS
