/**
 * Windows 7 & Legacy Browser Polyfills
 * Google Chrome on Windows 7 is permanently capped at Chrome 109.0.5414.120.
 * Modern libraries (including pdfjs-dist v4+, Lucide, and modern ES2023/2024 features)
 * reference Iterator, Promise.withResolvers, URL.parse, Map.prototype.getOrInsertComputed, etc.
 * This file guarantees all these APIs exist globally before any application code executes.
 */

(function initPolyfills() {
  const g: any =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
      ? self
      : Function('return this')();

  // 1. globalThis.Iterator & window.Iterator (Required by pdfjs-dist, introduced in Chrome 122)
  if (typeof g.Iterator === 'undefined') {
    const IteratorConstructor: any = function Iterator(this: any) {};
    try {
      const iterPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
      IteratorConstructor.prototype = iterPrototype || {};
    } catch {
      IteratorConstructor.prototype = {};
    }

    IteratorConstructor.from = function from(iterable: any) {
      if (iterable && typeof iterable[Symbol.iterator] === 'function') {
        return iterable[Symbol.iterator]();
      }
      return iterable;
    };

    g.Iterator = IteratorConstructor;
    if (typeof window !== 'undefined') {
      (window as any).Iterator = IteratorConstructor;
    }
  }

  // Ensure Iterator.prototype has join, map, filter, etc. if pdfjs expects them
  if (g.Iterator && g.Iterator.prototype) {
    if (typeof g.Iterator.prototype.join !== 'function') {
      g.Iterator.prototype.join = function join(separator = ',') {
        const arr = Array.from(this as any);
        return arr.join(separator);
      };
    }
  }

  // 2. Promise.withResolvers (Chrome < 119)
  if (typeof (Promise as any).withResolvers !== 'function') {
    (Promise as any).withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: any) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  // 3. URL.parse & URL.canParse (Chrome < 120/126, used by pdfjs-dist)
  if (typeof (URL as any).parse !== 'function') {
    (URL as any).parse = function parse(url: string, base?: string | URL) {
      try {
        return new URL(url, base);
      } catch {
        return null;
      }
    };
  }

  if (typeof (URL as any).canParse !== 'function') {
    (URL as any).canParse = function canParse(url: string, base?: string | URL) {
      try {
        new URL(url, base);
        return true;
      } catch {
        return false;
      }
    };
  }

  // 4. Map.prototype.getOrInsertComputed (TC39 Stage 3 proposal used by pdfjs-dist)
  if (typeof (Map.prototype as any).getOrInsertComputed !== 'function') {
    (Map.prototype as any).getOrInsertComputed = function getOrInsertComputed(key: any, callbackfn: (key: any) => any) {
      if (this.has(key)) {
        return this.get(key);
      }
      const val = callbackfn(key);
      this.set(key, val);
      return val;
    };
  }

  // 5. Object.groupBy & Map.groupBy (Chrome < 117)
  if (typeof (Object as any).groupBy !== 'function') {
    (Object as any).groupBy = function groupBy<T, K extends PropertyKey>(
      items: Iterable<T>,
      callbackfn: (item: T, index: number) => K
    ) {
      const obj = Object.create(null);
      let idx = 0;
      for (const item of items) {
        const key = callbackfn(item, idx++);
        if (key in obj) {
          obj[key].push(item);
        } else {
          obj[key] = [item];
        }
      }
      return obj;
    };
  }

  if (typeof (Map as any).groupBy !== 'function') {
    (Map as any).groupBy = function groupBy<T, K>(
      items: Iterable<T>,
      callbackfn: (item: T, index: number) => K
    ) {
      const map = new Map<K, T[]>();
      let idx = 0;
      for (const item of items) {
        const key = callbackfn(item, idx++);
        if (map.has(key)) {
          map.get(key)!.push(item);
        } else {
          map.set(key, [item]);
        }
      }
      return map;
    };
  }

  // 6. Array.prototype change-by-copy methods (Chrome < 110)
  const arrayProto = Array.prototype as any;
  if (!arrayProto.toReversed) {
    arrayProto.toReversed = function toReversed() {
      return this.slice().reverse();
    };
  }

  if (!arrayProto.toSorted) {
    arrayProto.toSorted = function toSorted(compareFn?: (a: any, b: any) => number) {
      return this.slice().sort(compareFn);
    };
  }

  if (!arrayProto.toSpliced) {
    arrayProto.toSpliced = function toSpliced(start: number, deleteCount?: number, ...items: any[]) {
      const copy = this.slice();
      if (arguments.length === 1) {
        copy.splice(start);
      } else {
        copy.splice(start, deleteCount!, ...items);
      }
      return copy;
    };
  }

  // 7. Array.prototype.with
  if (!arrayProto.with) {
    arrayProto.with = function withIndex(index: number, value: any) {
      const len = this.length;
      const actualIndex = index < 0 ? len + index : index;
      if (actualIndex < 0 || actualIndex >= len) {
        throw new RangeError(`Invalid index: ${index}`);
      }
      const copy = this.slice();
      copy[actualIndex] = value;
      return copy;
    };
  }

  // 8. Array.prototype.at / String.prototype.at
  if (!arrayProto.at) {
    arrayProto.at = function at(n: number) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }

  const stringProto = String.prototype as any;
  if (!stringProto.at) {
    stringProto.at = function at(n: number) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return '';
      return this[n];
    };
  }

  // 9. Set methods (Chrome < 122: union, intersection, difference, etc.)
  const setProto = Set.prototype as any;
  if (typeof setProto.union !== 'function') {
    setProto.union = function union(other: any) {
      const result = new Set(this);
      for (const item of other) result.add(item);
      return result;
    };
  }
  if (typeof setProto.intersection !== 'function') {
    setProto.intersection = function intersection(other: any) {
      const result = new Set();
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of this) {
        if (otherSet.has(item)) result.add(item);
      }
      return result;
    };
  }
  if (typeof setProto.difference !== 'function') {
    setProto.difference = function difference(other: any) {
      const result = new Set(this);
      const otherSet = other instanceof Set ? other : new Set(other);
      for (const item of otherSet) result.delete(item);
      return result;
    };
  }
})();

export {};
