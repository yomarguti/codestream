"use strict";
const _debounce = require("lodash.debounce");
// const _once = require('lodash.once');

export interface IDeferrable {
	cancel(): void;
	flush(...args: any[]): void;
	pending?(): boolean;
}

interface IPropOfValue {
	(): any;
	value: string | undefined;
}

export namespace Functions {
	export function debounce<T extends Function>(
		fn: T,
		wait?: number,
		options?: { leading?: boolean; maxWait?: number; track?: boolean; trailing?: boolean }
	): T & IDeferrable {
		const { track, ...opts } = { track: false, ...(options || {}) } as {
			leading?: boolean;
			maxWait?: number;
			track?: boolean;
			trailing?: boolean;
		};

		if (track !== true) return _debounce(fn, wait, opts);

		let pending = false;

		const debounced = _debounce(
			(function(this: any) {
				pending = false;
				return fn.apply(this, arguments);
			} as any) as T,
			wait,
			options
		) as T & IDeferrable;

		const tracked = (function(this: any) {
			pending = true;
			return debounced.apply(this, arguments);
		} as any) as T & IDeferrable;

		tracked.pending = function() {
			return pending;
		};
		tracked.cancel = function() {
			return debounced.cancel.apply(debounced, arguments);
		};
		tracked.flush = function(...args: any[]) {
			return debounced.flush.apply(debounced, arguments);
		};

		return tracked;
	}

	export function debounceMerge<T extends Function>(
		fn: T,
		merger: (combined: any[] | undefined, current: any) => any[],
		wait?: number,
		options?: { leading?: boolean; maxWait?: number; trailing?: boolean }
	): T {
		let combined: any[] | undefined;
		let context: any;

		const debounced = debounce<T>(
			function() {
				if (combined === undefined) return fn.apply(context, [undefined]);

				const args = combined;
				combined = undefined;

				for (const arg of args) {
					fn.apply(context, [arg]);
				}
			} as any,
			wait,
			options
		);

		return function(this: any, ...args: any[]) {
			context = this;
			combined = merger.apply(context, [combined, ...args]);
			return debounced();
		} as any;
	}

	// interface Data {
	//     type: 'foo' | 'bar';
	//     values: string[];
	// }

	// const foo = (data: Data) => console.log(data);
	// const foodb = debounceMerge(foo, (combined: Data[] | undefined, current: Data) => {
	//     if (combined === undefined) return [current];

	//     const found = combined.find(_ => _.type === current.type);
	//     if (found === undefined) {
	//         combined.push(current);
	//     }
	//     else {
	//         found.values.push(...current.values);
	//     }
	//     return combined;
	// }, 1000);

	// foodb({ type: 'foo', values: ['foo'] });
	// foodb({ type: 'foo', values: ['bar'] });
	// foodb({ type: 'bar', values: ['1', '2', '3'] });
	// foodb({ type: 'foo', values: ['baz'] });

	// setTimeout(() => {
	//     foodb({ type: 'foo', values: ['baz'] });
	// }, 2000);

	// setTimeout(() => {
	//     foodb({ type: 'foo', values: ['4'] });
	//     foodb({ type: 'bar', values: ['5', '6'] });
	//     foodb({ type: 'bar', values: ['7'] });
	// }, 5000);

	export function decorate(decorator: (fn: Function, key: string) => Function): Function {
		return (target: any, key: string, descriptor: any) => {
			let fn;
			let fnKey;

			if (typeof descriptor.value === "function") {
				fn = descriptor.value;
				fnKey = "value";
			} else if (typeof descriptor.get === "function") {
				fn = descriptor.get;
				fnKey = "get";
			}

			if (!fn || !fnKey) throw new Error("Not supported");

			descriptor[fnKey] = decorator(fn, key);
		};
	}

	// export function once<T extends Function>(fn: T): T {
	//     return _once(fn);
	// }

	export function propOf<T, K extends Extract<keyof T, string>>(o: T, key: K) {
		const propOfCore = <T, K extends Extract<keyof T, string>>(o: T, key: K) => {
			const value: string =
				(propOfCore as IPropOfValue).value === undefined
					? key
					: `${(propOfCore as IPropOfValue).value}.${key}`;
			(propOfCore as IPropOfValue).value = value;
			const fn = <Y extends Extract<keyof T[K], string>>(k: Y) => propOfCore(o[key], k);
			return Object.assign(fn, { value: value });
		};
		return propOfCore(o, key);
	}

	export function seeded<T>(
		fn: (...args: any[]) => Promise<T>,
		seed: T
	): (...args: any[]) => Promise<T> {
		let cached: T | undefined = seed;
		return (...args: any[]) => {
			if (cached !== undefined) {
				const promise = Promise.resolve(cached);
				cached = undefined;

				return promise;
			}
			return fn(...args);
		};
	}

	export async function wait(ms: number) {
		await new Promise(resolve => setTimeout(resolve, ms));
	}

	export async function waitUntil(
		fn: (...args: any[]) => boolean,
		timeout: number
	): Promise<boolean> {
		const max = Math.round(timeout / 100);
		let counter = 0;
		while (true) {
			if (fn()) return true;
			if (counter > max) return false;

			await wait(100);
			counter++;
		}
	}
}
