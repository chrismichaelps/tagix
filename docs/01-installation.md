---
category: Getting Started
alias: installation
title: Installation & Setup
description: Learn how to install Tagix and configure your TypeScript project
---

# Installation

Install Tagix with your package manager of choice.

```bash
# npm
npm install tagix

# pnpm
pnpm add tagix

# yarn
yarn add tagix
```

## Requirements

**Tagix requires TypeScript 5.0 or later** for full type inference. There are no other runtime dependencies — Tagix is framework-agnostic and works with any UI library, or with no framework at all.

Tagix ships ES module and CommonJS builds plus type declarations, so it works in both `import` and `require` environments.

## Verify the Install

Create a small file and confirm the core exports resolve and infer correctly:

```ts
import { createStore, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});

const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
  name: "Counter",
});

console.log(store.stateValue._tag); // "Idle"
```

If that type-checks and runs, you are ready to go.

## Next Steps

| Topic                                | Description                                   |
| ------------------------------------ | --------------------------------------------- |
| [Quick Start](02-quick-start.md)     | Build your first Tagix application            |
| [Core Concepts](03-core-concepts.md) | Understand the fundamental ideas behind Tagix |
| [Architecture](04-architecture.md)   | How Tagix works internally                    |
