import * as uuidv4 from "uuid/v4";

export const safe = f => {
	try {
		return f();
	} catch (e) {
		return undefined;
	}
};

export const rangeTo = size => [...Array(size).keys()];

export const debounceToAnimationFrame = fn => {
	let result;
	let requestId;

	return function() {
		if (requestId) {
			cancelAnimationFrame(requestId);
		}
		requestId = requestAnimationFrame(() => {
			requestId = undefined;
			result = fn.apply(undefined, rangeTo(arguments.length).map(i => arguments[i]));
		});
		return result;
	};
};

export const toMapBy = (key, entities) =>
	entities.reduce((result, entity) => ({ ...result, [entity[key]]: entity }), {});

export const uuid = () => uuidv4();
export const shortUuid = () => {
	const data = new Uint8Array(16);
	uuidv4(null, data, 0);

	const base64 = btoa(String.fromCharCode.apply(null, data));
	return base64
		.replace(/\+/g, "-") // Replace + with - (see RFC 4648, sec. 5)
		.replace(/\//g, "_") // Replace / with _ (see RFC 4648, sec. 5)
		.substring(0, 22); // Drop '==' padding;
};

export const isChildOf = (node, parentId) => {
	while (node !== null) {
		if (node.id === parentId) {
			return true;
		}
		node = node.parentNode;
	}

	return false;
};

export const getCurrentCursorPosition = parentId => {
	var selection = window.getSelection(),
		charCount = -1,
		node;

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

export const createRange = (node, chars, range) => {
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
			for (var lp = 0; lp < node.childNodes.length; lp++) {
				range = createRange(node.childNodes[lp], chars, range);

				if (chars.count === 0) {
					break;
				}
			}
		}
	}

	return range;
};

// const name = this.constructor.displayName || this.constructor.name || "Component";
// console.group(name);
// console.debug("props", { prevProps, currProps: this.props });
// Object.keys(prevProps).forEach(key => {
// 	if (prevProps[key] !== this.props[key]) {
// 		console.log(`property ${key} changed from ${prevProps[key]} to ${this.props[key]}`);
// 	}
// });
// console.groupEnd(name);
