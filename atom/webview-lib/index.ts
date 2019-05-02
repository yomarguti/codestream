import { initialize, setupCommunication } from "@codestream/webview/index";

const setStyles = (stylesheets: string[]) => {
	const stylesContainer = document.querySelector("codestream-styles")!;
	stylesheets.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		stylesContainer.appendChild(style);
	});
};

window.addEventListener("message", ({ data, ports }) => {
	if (data.label === "codestream-webview-initialize") {
		setupCommunication(ports[0]);
		setStyles(data.styles);
		initialize("#app");
	}
	if (data.label === "update-styles") {
		// TODO: clear out the existing ones?
		setStyles(data.styles);
	}
});

document.addEventListener(
	"click",
	(e: MouseEvent) => {
		if (e == null || e.target == null || (e.target as Element).tagName !== "A") return;

		const target = e.target as HTMLAnchorElement;
		if (target.href) {
			window.postMessage({ label: "open-link", link: target.href }, "*");
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	},
	true
);

const isWindows = navigator.platform.toLowerCase().startsWith("win");

const elementStrategy = {
	INPUT: {
		selectAll(input: HTMLInputElement) {
			input.setSelectionRange(0, input.value.length);
		},
		async paste(input: HTMLInputElement) {
			const text = await (navigator as any).clipboard.readText();
			const cursorStart = input.selectionStart!;
			const cursorEnd = input.selectionEnd!;
			const newCursorPosition = cursorEnd + text.length;
			input.value = `${input.value.substr(0, cursorStart)}${text}${input.value.substr(cursorEnd)}`;
			input.setSelectionRange(newCursorPosition, newCursorPosition);
		},
		cut(input: HTMLInputElement) {
			const selection = window.getSelection();
			if (selection.toString().trim() === "") return;
			copy();
			input.value = `${input.value.replace(selection.toString(), "")}`;
		},
	},
	DIV: {
		selectAll(div: HTMLDivElement) {
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(div);
			selection.removeAllRanges();
			selection.addRange(range);
		},
		async paste(div: HTMLDivElement) {
			const text = await (navigator as any).clipboard.readText();

			const textNode = document.createTextNode(text);
			const selection = window.getSelection();
			if (selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				range.insertNode(textNode);
				range.setStartAfter(textNode);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		},
		cut(div: HTMLDivElement) {
			const selection = window.getSelection();
			copy();
			selection.deleteFromDocument();
		},
	},
};

async function copy() {
	const selection = window.getSelection();
	try {
		await (navigator as any).clipboard.writeText(selection.toString());
	} catch (error) {
		console.error("codestream could not copy selection");
	}
}

document.addEventListener(
	"keydown",
	async (e: KeyboardEvent) => {
		if (e == null || e.target == null) return;

		const hasMetaForCopyPaste = isWindows ? e.ctrlKey : e.metaKey;
		const target = e.target as Element;
		if (
			!["TEXTAREA", "INPUT"].includes(target.tagName) &&
			target.getAttribute("contentEditable") !== "true"
		) {
			return;
		}

		switch (e.key) {
			case "a": {
				if (hasMetaForCopyPaste) {
					e.stopPropagation();
					elementStrategy[target.tagName].selectAll(target);
				}
				break;
			}
			case "c": {
				if (hasMetaForCopyPaste) {
					e.stopPropagation();
					copy();
				}
				break;
			}
			case "v": {
				if (hasMetaForCopyPaste) {
					e.stopPropagation();
					elementStrategy[target.tagName].paste(target);
				}
				break;
			}
			case "x": {
				if (hasMetaForCopyPaste) {
					e.stopPropagation();
					elementStrategy[target.tagName].cut(target);
				}
				break;
			}
		}
	},
	true
);
