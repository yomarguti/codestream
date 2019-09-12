import { initialize, setupCommunication } from "@codestream/webview/index";

declare function acquireAtomApi();
const api = acquireAtomApi();

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

function patchConsole() {
	const supportedLogMethods = ["log", "debug", "warn", "error"];

	const console = window.console;

	const patch = {};

	const patchedLogMethods = {
		log(message: any, ...args: any[]) {
			api.send("did-log", { type: "log", message, args });
			console.log.apply(console, [message, ...args]);
		},
		debug(message: any, ...args: any[]) {
			api.send("did-log", { type: "debug", message, args });
			console.debug.apply(console, [message, ...args]);
		},
		warn(message: any, ...args: any[]) {
			api.send("did-log", { type: "warn", message, args });
			console.warn.apply(console, [message, ...args]);
		},
		error(message: any, ...args: any[]) {
			api.send("did-log", { type: "error", message, args });
			console.error.apply(console, [message, ...args]);
		},
	};

	const consoleProxy = new Proxy(patch, {
		get(target: any, property: any) {
			if (supportedLogMethods.includes(property)) {
				return patchedLogMethods[property];
			}

			return console[property];
		},
	});

	Object.defineProperty(window, "console", {
		value: consoleProxy,
	});
}

const channel = new MessageChannel();

// receive message from host
api.on("codestream-ui", message => channel.port1.postMessage(message));
// send message to host
channel.port1.onmessage = message => api.send("codestream-ui", message.data);
// port for ui code to listen and post to
setupCommunication(channel.port2);

api.on("initialize", ({ isDebugging, styles }) => {
	if (!isDebugging) {
		patchConsole();
	}

	setStyles(styles);

	initialize("#app");
});

api.on("did-change-styles", setStyles);
