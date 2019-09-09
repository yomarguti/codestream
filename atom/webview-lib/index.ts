import { initialize, setupCommunication } from "@codestream/webview/index";

declare function acquireAtomApi();

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

const api = acquireAtomApi();
const channel = new MessageChannel();

// receive message from host
api.onDidReceiveCSMessage(message => channel.port1.postMessage(message), false);
// send message to host
channel.port1.onmessage = message => api.send(message.data);
// port for ui code to listen and post to
setupCommunication(channel.port2);

api.onDidReceiveHarnessMessage(message => {
	if (message.label === "codestream-webview-initialize") {
		setStyles(message.styles);

		// if (!data.isDebugging) {
		// 	Object.defineProperty(window, "console", {
		// 		value: consoleProxy,
		// 	});
		// }

		initialize("#app");
	}
	if (message.label === "update-styles") {
		setStyles(message.styles);
	}
});

// document.addEventListener(
// 	"click",
// 	(e: MouseEvent) => {
// 		if (e == null || e.target == null) return;
//
// 		if ((e.target as any).href) debugger;
//
// 		const target = e.target as HTMLAnchorElement;
// 		if (target.href) {
// 			api.sendHarnessMessage({ label: "open-link", link: target.href });
// 			e.preventDefault();
// 			e.stopPropagation();
// 			e.stopImmediatePropagation();
// 		}
// 	},
// 	true
// );
