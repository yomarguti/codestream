import "resize-observer";
import React from "react";
import ReactDOM from "react-dom";
import { Container, createStore, EventEmitter, WebviewApi } from "codestream-components";
import translations from "codestream-components/translations/en.json";
import loggingMiddleWare from "./logging-middleware";

const cssColorRegEx = /^(?:(#?)([0-9a-f]{3}|[0-9a-f]{6})|((?:rgb|hsl)a?)\((-?\d+%?)[,\s]+(-?\d+%?)[,\s]+(-?\d+%?)[,\s]*(-?[\d\.]+%?)?\))$/i;

function adjustLight(color, amount) {
	const cc = color + amount;
	const c = amount < 0 ? (cc < 0 ? 0 : cc) : cc > 255 ? 255 : cc;

	return Math.round(c);
}

function darken(color, percentage) {
	return lighten(color, -percentage);
}

function lighten(color, percentage) {
	const rgba = toRgba(color);
	if (rgba == null) return color;

	const [r, g, b, a] = rgba;
	percentage = (255 * percentage) / 100;
	return `rgba(${adjustLight(r, percentage)}, ${adjustLight(g, percentage)}, ${adjustLight(
		b,
		percentage
	)}, ${a})`;
}

function opacity(color, percentage) {
	const rgba = toRgba(color);
	if (rgba == null) return color;

	const [r, g, b, a] = rgba;
	return `rgba(${r}, ${g}, ${b}, ${a * (percentage / 100)})`;
}

function toRgba(color) {
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

function initializeColorPalette() {
	const onColorThemeChanged = () => {
		const body = document.body;
		const computedStyle = getComputedStyle(body);

		let theme = "dark";
		if (body.classList.contains("vscode-light")) {
			theme = "light";
		} else if (body.classList.contains("vscode-highcontrast")) {
			// TODO
			// theme = 'highcontrast';
		}

		const bodyStyle = body.style;
		let color = computedStyle.getPropertyValue("--color").trim();
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

		color = computedStyle.getPropertyValue("--background-color").trim();
		switch (theme) {
			case "dark":
				bodyStyle.setProperty("--app-background-color", color);
				bodyStyle.setProperty("--app-background-color-darker", darken(color, 4));
				bodyStyle.setProperty("--app-background-color-hover", lighten(color, 3));

				bodyStyle.setProperty("--base-background-color", lighten(color, 4));
				bodyStyle.setProperty("--base-border-color", lighten(color, 8));
				bodyStyle.setProperty("--tool-panel-background-color", lighten(color, 10));
				break;

			case "light":
				bodyStyle.setProperty("--app-background-color", color);
				bodyStyle.setProperty("--app-background-color-hover", darken(color, 7));

				bodyStyle.setProperty("--base-background-color", darken(color, 3));
				bodyStyle.setProperty("--base-border-color", darken(color, 10));
				bodyStyle.setProperty("--tool-panel-background-color", darken(color, 10));
				break;
		}

		color = computedStyle.getPropertyValue("--link-color").trim();
		switch (theme) {
			case "dark":
				bodyStyle.setProperty("--text-color-info-muted", darken(color, 10));
				break;
			case "light":
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

setTimeout(() => {
	document.body.classList.remove("preload");
}, 1000); // Wait for animations to complete

const data = window.bootstrap;

const store = createStore(
	{
		pluginVersion: data.version,
		startOnMainPanel: Boolean(data.currentStreamId),
		context: {
			currentTeamId: data.currentTeamId,
			currentStreamId: data.currentStreamId,
			hasFocus: true
		},
		session: {
			userId: data.currentUserId
		},
		umis: data.unreads
	},
	{ api: new WebviewApi() },
	[loggingMiddleWare]
);

store.dispatch({ type: "UPDATE_CONFIGS", payload: data.configs || {} });

EventEmitter.on("data", ({ type, payload }) => {
	store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload });
});

EventEmitter.on("data:unreads", unreads => {
	store.dispatch({ type: `UPDATE_UNREADS`, payload: unreads });
});

EventEmitter.on("configs", configs => store.dispatch({ type: "UPDATE_CONFIGS", payload: configs }));

EventEmitter.on("interaction:focus", () => {
	setTimeout(() => {
		store.dispatch({ type: "SET_HAS_FOCUS", payload: true });
	}, 10); // we want the first click to go to the FocusTrap blanket
});
EventEmitter.on("interaction:blur", () => {
	store.dispatch({ type: "SET_HAS_FOCUS", payload: false });
});

if (data.currentUserId) {
	store.dispatch({ type: "BOOTSTRAP_USERS", payload: data.users });
	store.dispatch({ type: "BOOTSTRAP_TEAMS", payload: data.teams });
	store.dispatch({ type: "BOOTSTRAP_STREAMS", payload: data.streams });
}
store.dispatch({ type: "BOOTSTRAP_COMPLETE" });

ReactDOM.render(
	<Container store={store} i18n={{ locale: "en", messages: translations }} />,
	document.querySelector("#app")
);
