---
category: Guide
alias: documentation
title: Tagix Documentation
description: Tagix is a TypeScript state management library built on functional programming primitives
---

# Tagix Documentation

Tagix is a TypeScript state management library built on functional programming primitives. This documentation provides comprehensive coverage of all features, patterns, and integrations.

## Getting Started

| Topic                                | Description                          |
| ------------------------------------ | ------------------------------------ |
| [Installation](01-installation.md)   | How to install and set up Tagix      |
| [Quick Start](02-quick-start.md)     | Build your first Tagix application   |
| [Core Concepts](03-core-concepts.md) | Fundamental concepts and terminology |
| [Architecture](04-architecture.md)   | System design and internals          |

## State Management

| Topic                                        | Description                          |
| -------------------------------------------- | ------------------------------------ |
| [State Definitions](10-state-definitions.md) | Defining state with tagged unions    |
| [Actions](11-actions.md)                     | Synchronous action creators          |
| [Async Actions](12-async-actions.md)         | Asynchronous operations with effects |
| [State Machines](13-state-machines.md)       | Building state machines              |

## Features

| Topic                                  | Description                    |
| -------------------------------------- | ------------------------------ |
| [Selectors](20-selectors.md)           | Type-safe state selection      |
| [Middleware](21-middleware.md)         | Extending dispatch behavior    |
| [Context](22-context.md)               | Framework-agnostic integration |
| [Error Handling](23-error-handling.md) | Structured error management    |

## Advanced Topics

| Topic                            | Description                 |
| -------------------------------- | --------------------------- |
| [Type Safety](40-type-safety.md) | Leveraging TypeScript fully |
| [Testing](41-testing.md)         | Testing strategies          |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to Tagix.

---

**Tagix requires TypeScript 5.0 or later** for full type inference capabilities.

All documentation files are written in Markdown and can be viewed directly on GitHub. The `docs` folder contains all source files, and you can navigate using the links above or the sidebar configuration in `.sidebar.json`.
