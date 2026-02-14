---
category: Guide
alias: documentation
title: Tagix Documentation
description: Tagix is a TypeScript state management library built on functional programming principles
---

# Tagix Documentation

Tagix is a TypeScript state management library for building reliable applications. It combines tagged unions for state representation with actions for state transitions, providing end-to-end type safety.

## Why Tagix

Tagix solves common state management problems by giving you clear structure for your state, predictable state transitions, and full TypeScript support. The library focuses on making state changes explicit and traceable through your application.

You should consider Tagix when your application has complex state logic, multiple states that transition between each other, or when you want strong type safety throughout your state management layer.

## Getting Started

| Topic                                | Description                        |
| ------------------------------------ | ---------------------------------- |
| [Installation](01-installation.md)   | Set up Tagix in your project       |
| [Quick Start](02-quick-start.md)     | Build your first Tagix application |
| [Core Concepts](03-core-concepts.md) | Fundamental ideas behind Tagix     |
| [Architecture](04-architecture.md)   | How Tagix works internally         |

## State Management

| Topic                                        | Description                               |
| -------------------------------------------- | ----------------------------------------- |
| [State Definitions](10-state-definitions.md) | Define state using tagged unions          |
| [Actions](11-actions.md)                     | Synchronous action creators               |
| [Async Actions](12-async-actions.md)         | Asynchronous operations with side effects |
| [State Machines](13-state-machines.md)       | Build state machines                      |
| [Action Groups](14-action-groups.md)         | Namespace actions to avoid collisions     |

## Features

| Topic                                  | Description                      |
| -------------------------------------- | -------------------------------- |
| [Selectors](20-selectors.md)           | Extract and transform state data |
| [Middleware](21-middleware.md)         | Extend dispatch behavior         |
| [Context](22-context.md)               | Framework-agnostic integration   |
| [Error Handling](23-error-handling.md) | Handle errors gracefully         |
| [Hooks](24-hooks.md)                   | Type-safe state access utilities |
| [Services](25-services.md)             | Manage application dependencies  |

## Advanced Topics

| Topic                            | Description                  |
| -------------------------------- | ---------------------------- |
| [Type Safety](40-type-safety.md) | Get the most from TypeScript |
| [Testing](41-testing.md)         | Test your state logic        |

---

**Tagix requires TypeScript 5.0 or later** for full type inference.

All documentation files are written in Markdown and can be viewed directly on GitHub. The docs folder contains all source files, and you can navigate using the links above.
