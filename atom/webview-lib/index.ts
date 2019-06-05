import { initialize, setupCommunication } from "@codestream/webview/index";

const lightClass = "vscode-light";
const darkClass = "vscode-dark";

const setStyles = (stylesheets: string[]) => {
	const stylesContainer = document.querySelector("codestream-styles")!;
	stylesContainer.innerHTML = "";
	stylesheets.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerHTML = stylesheet;
		stylesContainer.appendChild(style);
	});

	const computedStyle = getComputedStyle(document.body);
	const [set, remove] =
		computedStyle.getPropertyValue("--in-dark-mode").trim() === "true"
			? [darkClass, lightClass]
			: [lightClass, darkClass];

	document.body.classList.remove(remove);
	document.body.classList.add(set);
};

const extensionLogMethods = {
	log(message: any, ...args: any[]) {
		window.postMessage({ label: "log", type: "log", message, args }, "*");
	},
	debug(message: any, ...args: any[]) {
		window.postMessage({ label: "log", type: "debug", message, args }, "*");
	},
	warn(message: any, ...args: any[]) {
		window.postMessage({ label: "log", type: "warn", message, args }, "*");
	},
	error(message: any, ...args: any[]) {
		window.postMessage({ label: "log", type: "error", message, args }, "*");
	},
};

function noop() {}

const logMethods = ["log", "debug", "warn", "error"];

const consoleProxy = new Proxy(window.console, {
	get(target: any, property: any) {
		if (property === "groupCollapsed") return noop;

		if (logMethods.includes(property)) {
			return extensionLogMethods[property];
		}
		return target[property];
	},
});

window.addEventListener("message", ({ data, ports }) => {
	if (data.label === "codestream-webview-initialize") {
		setupCommunication(ports[0]);
		setStyles(data.styles);

		if (!data.isDebugging) {
			Object.defineProperty(window, "console", {
				value: consoleProxy,
			});
		}

		initialize("#app");
	}
	if (data.label === "update-styles") {
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
