import {
	GetViewBootstrapDataRequestType,
	JoinLiveShareRequestType,
	WebviewReadyNotificationType
} from "@codestream/protocols/webview";
import { actions, Container, createStore, HostApi, listenForEvents } from "@codestream/webview";
import translations from "@codestream/webview/translations/en";
import React from "react";
import { render } from "react-dom";
import loggingMiddleWare from "./logging-middleware";

const vscodeApi = acquireVsCodeApi();
const channel = new MessageChannel();
Object.defineProperty(window, "acquireCodestreamHost", {
	value() {
		return channel.port2;
	}
});
window.addEventListener(
	"message",
	message => {
		channel.port1.postMessage(message.data);
	},
	false
);
channel.port1.onmessage = message => {
	vscodeApi.postMessage(message.data);
};

const cssColorRegEx = /^(?:(#?)([0-9a-f]{3}|[0-9a-f]{6})|((?:rgb|hsl)a?)\((-?\d+%?)[,\s]+(-?\d+%?)[,\s]+(-?\d+%?)[,\s]*(-?[\d\.]+%?)?\))$/i;

function adjustLight(color: number, amount: number) {
	const cc = color + amount;
	const c = amount < 0 ? (cc < 0 ? 0 : cc) : cc > 255 ? 255 : cc;

	return Math.round(c);
}

function darken(color: string, percentage: number) {
	return lighten(color, -percentage);
}

function lighten(color: string, percentage: number) {
	const rgba = toRgba(color);
	if (rgba == null) return color;

	const [r, g, b, a] = rgba;
	percentage = (255 * percentage) / 100;
	return `rgba(${adjustLight(r, percentage)}, ${adjustLight(g, percentage)}, ${adjustLight(
		b,
		percentage
	)}, ${a})`;
}

function opacity(color: string, percentage: number) {
	const rgba = toRgba(color);
	if (rgba == null) return color;

	const [r, g, b, a] = rgba;
	return `rgba(${r}, ${g}, ${b}, ${a * (percentage / 100)})`;
}

function toRgba(color: string) {
	color = color.trim();

	const result = cssColorRegEx.exec(color);
	if (result == null) return null;

	if (result[1] === "#") {
		const hex = result[2];
		switch (hex.length) {
			case 3:
				return [
					parseInt(hex[0] + hex[0], 16),
					parseInt(hex[1] + hex[1], 16),
					parseInt(hex[2] + hex[2], 16),
					1
				];
			case 6:
				return [
					parseInt(hex.substring(0, 2), 16),
					parseInt(hex.substring(2, 4), 16),
					parseInt(hex.substring(4, 6), 16),
					1
				];
		}

		return null;
	}

	switch (result[3]) {
		case "rgb":
			return [parseInt(result[4], 10), parseInt(result[5], 10), parseInt(result[6], 10), 1];
		case "rgba":
			return [
				parseInt(result[4], 10),
				parseInt(result[5], 10),
				parseInt(result[6], 10),
				parseFloat(result[7])
			];
		default:
			return null;
	}
}

let theme;

function initializeColorPalette() {
	const onColorThemeChanged = () => {
		const body = document.body;
		const computedStyle = getComputedStyle(body);

		const bodyStyle = body.style;
		bodyStyle.setProperty(
			"--font-size",
			computedStyle.getPropertyValue("--vscode-editor-font-size").trim()
		);
		bodyStyle.setProperty(
			"--font-family",
			computedStyle.getPropertyValue("--vscode-editor-font-family").trim()
		);
		bodyStyle.setProperty(
			"--font-weight",
			computedStyle.getPropertyValue("--vscode-editor-font-weight").trim()
		);

		theme = "dark";
		if (body.classList.contains("vscode-light")) {
			theme = "light";
		} else if (body.classList.contains("vscode-highcontrast")) {
			// TODO
			// theme = 'highcontrast';
		}

		let color = computedStyle.getPropertyValue("--vscode-editor-foreground").trim();
		if (!color) {
			color = computedStyle.getPropertyValue("--vscode-foreground").trim();
		}
		bodyStyle.setProperty("--text-color", opacity(color, 80));
		bodyStyle.setProperty("--text-color-highlight", color);
		bodyStyle.setProperty("--text-color-subtle", opacity(color, 60));
		switch (theme) {
			case "dark":
				bodyStyle.setProperty("--text-color-subtle-extra", lighten(opacity(color, 60), 50));
				break;

			case "light":
				bodyStyle.setProperty("--text-color-subtle-extra", darken(opacity(color, 60), 50));
				break;
		}

		color = computedStyle.getPropertyValue("--vscode-editor-background").trim();
		switch (theme) {
			case "dark":
				bodyStyle.setProperty("--app-background-color", color);
				bodyStyle.setProperty("--app-background-color-darker", darken(color, 4));
				bodyStyle.setProperty("--app-background-color-hover", lighten(color, 3));

				bodyStyle.setProperty("--base-background-color", lighten(color, 4));
				bodyStyle.setProperty("--base-border-color", lighten(color, 10));
				bodyStyle.setProperty("--tool-panel-background-color", lighten(color, 10));
				break;

			case "light":
				bodyStyle.setProperty("--app-background-color", color);
				bodyStyle.setProperty("--app-background-color-hover", darken(color, 1.5));

				bodyStyle.setProperty("--base-background-color", darken(color, 3));
				bodyStyle.setProperty("--base-border-color", darken(color, 10));
				bodyStyle.setProperty("--tool-panel-background-color", darken(color, 10));
				break;
		}

		color = computedStyle.getPropertyValue("--vscode-textLink-foreground").trim();
		switch (theme) {
			case "dark":
				bodyStyle.setProperty("--text-color-info", color);
				bodyStyle.setProperty("--text-color-info-muted", darken(color, 10));
				break;
			case "light":
				bodyStyle.setProperty("--text-color-info", color);
				bodyStyle.setProperty("--text-color-info-muted", color);
				break;
		}
	};

	const observer = new MutationObserver(onColorThemeChanged);
	observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

	onColorThemeChanged();
	return observer;
}

initializeColorPalette();

const start = Date.now();
const api = HostApi.instance;
api.send(GetViewBootstrapDataRequestType).then((data: any) => {
	const store = createStore(
		{
			pluginVersion: data.version,
			context: {
				...(data.context || {}),
				currentTeamId: data.currentTeamId,
				currentStreamId: data.currentStreamId,
				threadId: data.currentThreadId,
				hasFocus: true,
				textEditorVisibleRanges: data.visibleRanges,
				textEditorUri: data.textEditorUri
			},
			session: {
				userId: data.currentUserId
			},
			umis: data.unreads,
			preferences: data.preferences,
			capabilities: data.capabilities,
			...(data.configs.email ? { route: { route: "login" } } : {})
		},
		undefined,
		[loggingMiddleWare]
	);

	// TODO: should be able to include data.configs in call to createStore
	store.dispatch(actions.updateConfigs(data.configs || {}));

	listenForEvents(store);

	const doRender = () => {
		setTimeout(() => {
			document.body.classList.remove("preload");
		}, 1000); // Wait for animations to complete

		render(
			<Container store={store} i18n={{ locale: "en", messages: translations }} />,
			document.querySelector("#app"),
			() => api.send(WebviewReadyNotificationType)
		);
	};

	const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?/;

	document.body.addEventListener(
		"click",
		function(e) {
			if (e == null || e.target == null || e.target.tagName !== "A") return;

			if (!vslsUrlRegex.test(e.target.href)) return;

			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			api.command(JoinLiveShareRequestType, {
				url: e.target.href
			});
		},
		true
	);

	store.dispatch(actions.bootstrap(data)).then(() => {
		const duration = Date.now() - start;
		if (duration < 250) {
			setTimeout(doRender, 250 - duration);
		} else {
			doRender();
		}
	});
});
