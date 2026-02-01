/*
MIT License

Copyright (c) 2026 Chris M. (Michael) Pérez

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

import type { MiddlewareContext, Action, AsyncAction } from "../types";

interface LoggerOptions {
  collapsed?: boolean | ((action: Action | AsyncAction) => boolean);
  duration?: boolean;
  timestamp?: boolean;
  level?: "log" | "warn" | "error" | "info";
  diff?: boolean;
  predicate?: (action: Action | AsyncAction) => boolean;
  stateTransformer?: (state: unknown) => unknown;
  actionTransformer?: (action: unknown) => unknown;
}

type ConsoleMethod = "log" | "warn" | "error" | "info";

function getConsoleMethod(level: ConsoleMethod): Console["log" | "warn" | "error" | "info"] {
  return console[level] as Console["log" | "warn" | "error" | "info"];
}

/**
 * Creates a middleware that logs actions and state changes to the console.
 * @param options - Logger configuration options.
 * @returns A middleware function.
 * @remarks Supports collapsed groups, timestamps, duration tracking, and custom transformers.
 * @example
 * ```ts
 * const logger = createLoggerMiddleware({
 *   collapsed: true,
 *   duration: true,
 *   predicate: (action) => action.type.includes("User")
 * });
 * ```
 */
export function createLoggerMiddleware(options: LoggerOptions = {}) {
  const {
    collapsed = false,
    duration = true,
    timestamp = true,
    level = "log",
    diff = false,
    predicate,
    stateTransformer = (state) => state,
    actionTransformer = (action) => action,
  } = options;

  const log = getConsoleMethod(level);

  return function loggerMiddleware<S extends { readonly _tag: string }>(
    _context: MiddlewareContext<S>
  ) {
    return function logger(next: (action: Action | AsyncAction) => void) {
      return function loggerExecutor(action: Action | AsyncAction) {
        const startTime = Date.now();

        if (predicate && !predicate(action)) {
          return next(action);
        }

        const transformedAction = actionTransformer(action);
        const actionType = action.type;

        const shouldCollapse = typeof collapsed === "function" ? collapsed(action) : collapsed;

        const time = timestamp ? new Date().toISOString().substr(11, 12) : "";
        const actionTitle = `action ${actionType}${time ? ` @ ${time}` : ""}`;

        if (shouldCollapse) {
          console.groupCollapsed?.(`%c${actionTitle}`, "color: #9E9E9E; font-weight: bold;");
        } else {
          const groupResult = console.group?.(
            `%c${actionTitle}`,
            "color: #9E9E9E; font-weight: bold;"
          );
          if (groupResult === undefined) {
            log(`%c${actionTitle}`, "color: #9E9E9E; font-weight: bold;");
          }
        }

        log(
          `%c action %c`,
          "color: #03A9F4; font-weight: bold;",
          "color: inherit;",
          transformedAction
        );

        next(action);

        const endTime = Date.now();
        const took = endTime - startTime;

        if (duration) {
          log(`%c (in ${took.toFixed(2)} ms)`, "color: #9E9E9E; font-weight: bold;");
        }

        console.groupEnd?.();
      };
    };
  };
}
