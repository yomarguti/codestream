import uuidv4 from "uuid/v4";
import { Range } from "vscode-languageserver-types";
import { MaxRangeValue } from "./ipc/webview.protocol";

export function forceAsLine(range: Range): Range {
	// If we don't have a selection assume a full line
	if (range.start.line === range.end.line && range.start.character === range.end.character) {
		return Range.create(range.start.line, 0, range.start.line, MaxRangeValue);
	}
	return range;
}

export function arrayToRange([startLine, startCharacter, endLine, endCharacter]: number[]): Range {
	return Range.create(startLine, startCharacter, endLine, endCharacter);
}

export function pick<T, K extends keyof T>(object: T, keys: K[]): { [K in keyof T]: any } {
	return keys.reduce((result: T, key: K) => {
		result[key] = object[key];
		return result;
	}, Object.create(null));
}

export function isInVscode() {
	return !!document.querySelector("body.codestream");
}

export function capitalize([first, ...rest]: string[]) {
	return first.toUpperCase() + rest.join("");
}

export const safe = <T>(fn: () => T): T | undefined => {
	try {
		return fn();
	} catch (e) {
		return undefined;
	}
};

export function mapFilter<A, B>(array: A[], fn: (A) => B | undefined): B[] {
	const result: B[] = [];
	array.forEach(a => {
		const mapped = fn(a);
		if (mapped) {
			result.push(mapped);
		}
	});
	return result;
}

export const findLast = <T>(array: T[], fn: (item: T) => boolean): any | undefined => {
	for (let i = array.length - 1; i >= 0; i--) {
		const item = array[i];
		if (fn(item)) return item;
	}
};

export function range(start: number, end: number): number[] {
	const array: number[] = [];
	for (let i = start; i < end; i++) {
		array.push(i);
	}
	return array;
}

// let fnCount = 0;
// TODO: maybe make the debounced fn async so callers can wait for it to execute
export const debounceToAnimationFrame = (fn: Function) => {
	let requestId: number | undefined;
	// const i = fnCount++;
	// const label = `fn[${i}]`;
	// let resetTimer = true;
	// console.debug(`${label} registered for debouncing`, fn);
	return function(...args: any[]) {
		// if (resetTimer) {
		// 	console.time(label);
		// 	resetTimer = false;
		// }
		if (requestId) {
			// console.debug(`debouncing ${label}`);
			cancelAnimationFrame(requestId);
		}
		requestId = requestAnimationFrame(() => {
			// resetTimer = true;
			requestId = undefined;
			// console.timeEnd(label);
			fn(...args);
		});
	};
};

// if the callers of fn expect their arguments to be used anytime fn is
// actually invoked, then those arguments should be collected and passed to fn.
export function debounceAndCollectToAnimationFrame(fn: Function): Function {
	let requestId: number | undefined;
	let argsToUse: any[] = [];

	return (...args: any[]) => {
		argsToUse.push(...args);

		if (requestId) {
			cancelAnimationFrame(requestId);
		}
		requestId = requestAnimationFrame(() => {
			requestId = undefined;
			fn(...argsToUse);
			argsToUse = [];
		});
	};
}

export const rAFThrottle = (fn: Function): Function => {
	let requestId: number | undefined;
	let lastArgs: any[] = [];

	const throttledFn = function(...args: any[]) {
		lastArgs = args;
		if (requestId) {
			console.debug(`rAFThrottle is throttling a call to ${fn}. new args are`, args);
			return;
		}
		requestId = requestAnimationFrame(() => {
			requestId = undefined;
			fn(...lastArgs);
		});
	};

	throttledFn.cancel = () => {
		if (requestId) cancelAnimationFrame(requestId);
	};

	return throttledFn;
};

export function toMapBy<Key extends keyof T, T>(key: Key, entities: T[]): { [key: string]: T } {
	return entities.reduce(function(map, entity) {
		map[entity[key]] = entity;
		return map;
	}, Object.create(null));
}

export const uuid = uuidv4;
export const shortUuid = () => {
	const data = new Uint8Array(16);
	uuidv4(null, data, 0);

	const base64 = btoa(String.fromCharCode.apply(null, data as any));
	return base64
		.replace(/\+/g, "-") // Replace + with - (see RFC 4648, sec. 5)
		.replace(/\//g, "_") // Replace / with _ (see RFC 4648, sec. 5)
		.substring(0, 22); // Drop '==' padding;
};

export const isChildOf = (node: any, parentId: string) => {
	while (node !== null) {
		if (node.id === parentId) {
			return true;
		}
		node = node.parentNode;
	}

	return false;
};

export const getCurrentCursorPosition = (parentId: string) => {
	const selection = window.getSelection();
	let charCount = -1;
	let node: any;

	// console.log(selection);
	if (selection.focusNode) {
		if (isChildOf(selection.focusNode, parentId)) {
			node = selection.focusNode;
			charCount = selection.focusOffset;

			while (node) {
				if (node.id === parentId) {
					break;
				}

				if (node.previousSibling) {
					node = node.previousSibling;
					charCount += node.textContent.length;
				} else {
					node = node.parentNode;
					if (node === null) {
						break;
					}
				}
			}
		}
	}
	return charCount;
};

export const createRange = (node: any, chars: any, range?: any) => {
	if (!range) {
		range = document.createRange();
		range.selectNode(node);
		range.setStart(node, 0);
	}

	if (chars.count === 0) {
		range.setEnd(node, chars.count);
	} else if (node && chars.count > 0) {
		if (node.nodeType === Node.TEXT_NODE) {
			if (node.textContent.length < chars.count) {
				chars.count -= node.textContent.length;
			} else {
				range.setEnd(node, chars.count);
				chars.count = 0;
			}
		} else {
			for (const child of node.childNodes) {
				range = createRange(child, chars, range);

				if (chars.count === 0) {
					break;
				}
			}
		}
	}

	return range;
};

export function logDiff<Props, State>(context, prevProps: Props) {
	const name = context.constructor.displayName || context.constructor.name || "Component";
	console.group(name);
	console.debug("props", { prevProps, currProps: context.props });
	Object.keys(prevProps).forEach(key => {
		if (prevProps[key] !== context.props[key]) {
			console.warn(`prop ${key} changed from ${prevProps[key]} to ${context.props[key]}`);
		}
	});
	console.groupEnd();
}

const htmlEscapeCharMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;"
};

export function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, function(c) {
		return htmlEscapeCharMap[c];
	});
}
