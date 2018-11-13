"use strict";
import { debounce as _debounce } from "lodash-es";

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
	export function cachedOnce<T>(
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

	export function debounce<T extends (...args: any[]) => any>(
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

	export function debounceMerge<T extends (...args: any[]) => any>(
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

	export function getParameters(fn: Function): string[] {
		if (typeof fn !== "function") throw new Error("Not supported");

		if (fn.length === 0) return [];

		const stripCommentsRegex = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/gm;
		let fnBody: string = Function.prototype.toString.call(fn);
		fnBody = fnBody.replace(stripCommentsRegex, "") || fnBody;
		fnBody = fnBody.slice(0, fnBody.indexOf("{"));

		let open = fnBody.indexOf("(");
		let close = fnBody.indexOf(")");

		open = open >= 0 ? open + 1 : 0;
		close = close > 0 ? close : fnBody.indexOf("=");

		fnBody = fnBody.slice(open, close);
		fnBody = `(${fnBody})`;

		const match = fnBody.match(/\(([\s\S]*)\)/);
		return match != null ? match[1].split(",").map(param => param.trim()) : [];
	}

	export function isPromise(o: any) {
		return (typeof o === "object" || typeof o === "function") && typeof o.then === "function";
	}

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

	export function progress<T>(
		promise: Promise<T>,
		intervalMs: number,
		onProgress: () => boolean
	): Promise<T> {
		return new Promise((resolve, reject) => {
			let timer: NodeJS.Timer | undefined;
			timer = setInterval(() => {
				if (onProgress()) {
					if (timer !== undefined) {
						clearInterval(timer);
						timer = undefined;
					}
				}
			}, intervalMs);

			promise.then(
				() => {
					if (timer !== undefined) {
						clearInterval(timer);
						timer = undefined;
					}

					resolve(promise);
				},
				ex => {
					if (timer !== undefined) {
						clearInterval(timer);
						timer = undefined;
					}

					reject(ex);
				}
			);
		});
	}

	export function timeout<T>(
		promise: Promise<T>,
		timeoutMs: number,
		options: {
			message?: string;
			onTimeout?(
				resolve: (value?: T | PromiseLike<T> | undefined) => void,
				reject: (reason?: any) => void,
				message: string | undefined
			): void;
		} = {}
	): Promise<T> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				if (typeof options.onTimeout === "function") {
					options.onTimeout(resolve, reject, options.message);
				} else {
					reject(new Error(options.message ? `${options.message} TIMED OUT` : "TIMED OUT"));
				}
			}, timeoutMs);

			promise.then(
				() => {
					clearTimeout(timer);
					resolve(promise);
				},
				ex => {
					clearTimeout(timer);
					reject(ex);
				}
			);
		});
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

	export function safe<T>(fn: () => T | undefined): T | undefined {
		try {
			return fn();
		} catch (e) {
			return;
		}
	}
}
