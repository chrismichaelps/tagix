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

import type { ServiceTag, ServiceRegistryInput, ServiceRegistry } from "./types";

const serviceTagCache = new Map<string, ServiceTag<unknown>>();

export function createServiceTag<T>(name: string): ServiceTag<T> {
  const cached = serviceTagCache.get(name) as ServiceTag<T> | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const tag: ServiceTag<T> = {
    _tag: Symbol(name) as ServiceTag<T>["_tag"],
    _service: null as unknown as T,
    _name: name,
  };

  serviceTagCache.set(name, tag as ServiceTag<unknown>);
  return tag;
}

export function createServiceRegistry<T extends ServiceRegistryInput>(
  input: T
): T & ServiceRegistry {
  return input as T & ServiceRegistry;
}
