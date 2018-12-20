import { install as polyFillResizeObserver } from "resize-observer";
import React from "react";
import ReactDOM from "react-dom";
import { actions, Container, createStore, EventEmitter, WebviewApi } from "codestream-components";
import translations from "codestream-components/translations/en.json";
import loggingMiddleWare from "./logging-middleware";

if (!window.ResizeObserver) {
	polyFillResizeObserver();
} else {
	console.warn("ResizeObserver is available");
}

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

let theme;

function initializeColorPalette() {
	const onColorThemeChanged = () => {
		const body = document.body;
		const computedStyle = getComputedStyle(body);

		theme = "dark";
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
				bodyStyle.setProperty("--app-background-color-hover", darken(color, 1.5));

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

const start = Date.now();
const api = new WebviewApi();
api.bootstrap().then(data => {
	let panel;
	if (data.currentStreamId) panel = "main";
	if (data.currentStreamId && data.currentThreadId) panel = "thread";
	const store = createStore(
		{
			pluginVersion: data.version,
			context: {
				currentTeamId: data.currentTeamId,
				currentStreamId: data.currentStreamId,
				threadId: data.currentThreadId,
				hasFocus: true,
				...(data.panelStack ? { panelStack: data.panelStack } : {})
			},
			session: {
				userId: data.currentUserId
			},
			umis: data.unreads,
			preferences: data.preferences,
			capabilities: data.capabilities,
			...(data.configs.email ? { route: { route: "login" } } : {})
		},
		{ api },
		[loggingMiddleWare]
	);

	// TODO: should be able to include data.configs in call to createStore
	store.dispatch(actions.updateConfigs(data.configs || {}));

	EventEmitter.on("data", ({ type, payload }) => {
		store.dispatch({ type: `ADD_${type.toUpperCase()}`, payload });
	});

	EventEmitter.on("data:unreads", unreads => {
		store.dispatch(actions.updateUnreads(unreads));
	});

	EventEmitter.on("data:preferences", preferences => {
		store.dispatch(actions.updatePreferences(preferences));
	});

	EventEmitter.on("configs", configs => store.dispatch(actions.updateConfigs(configs)));

	EventEmitter.on("connectivity:offline", () => store.dispatch(actions.offline()));
	EventEmitter.on("connectivity:online", () => store.dispatch(actions.online()));

	EventEmitter.on(
		"interaction:active-editor-changed",
		body => body.editor && store.dispatch(actions.fileChanged(body.editor))
	);

	EventEmitter.on("interaction:focus", () => {
		setTimeout(() => {
			store.dispatch(actions.focus());
		}, 10); // we want the first click to go to the FocusTrap blanket
	});
	EventEmitter.on("interaction:blur", () => {
		store.dispatch(actions.blur());
	});

	EventEmitter.on("interaction:signed-out", () => {
		store.dispatch(actions.reset());
	});

	const render = () => {
		setTimeout(() => {
			document.body.classList.remove("preload");
		}, 1000); // Wait for animations to complete

		ReactDOM.render(
			<Container store={store} i18n={{ locale: "en", messages: translations }} />,
			document.querySelector("#app"),
			() => EventEmitter.emit("view-ready")
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

			EventEmitter.emit("interaction:svc-request", {
				service: "vsls",
				action: {
					type: "join",
					url: e.target.href
				}
			});
		},
		true
	);

	store.dispatch(actions.bootstrap(data)).then(() => {
		const duration = Date.now() - start;
		if (duration < 250) {
			setTimeout(render, 250 - duration);
		} else {
			render();
		}
	});
});

class Snowflake {
	constructor() {
		this.x = 0;
		this.y = 0;
		this.vx = 0;
		this.vy = 0;
		this.radius = 0;
		this.alpha = 0;

		this.reset();
	}

	reset() {
		this.x = this.randBetween(0, window.innerWidth);
		this.y = this.randBetween(0, -window.innerHeight);
		this.vx = this.randBetween(-3, 3);
		this.vy = this.randBetween(2, 5);
		this.radius = this.randBetween(1, 4);
		this.alpha = this.randBetween(0.1, 0.9);
	}

	randBetween(min, max) {
		return min + Math.random() * (max - min);
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;

		if (this.y + this.radius > window.innerHeight) {
			this.reset();
		}
	}
}

class Snow {
	snowing = false;

	constructor() {
		this.canvas = document.querySelector("canvas.snow");
		this.ctx = this.canvas.getContext("2d");

		window.addEventListener("resize", () => this.onResize());
		this.onResize();

		const trigger = document.querySelector(".snow__trigger");
		trigger.addEventListener("click", () => this.onToggle());

		this.clearBound = this.clear.bind(this);
		this.updateBound = this.update.bind(this);
	}

	onToggle() {
		this.snowing = !this.snowing;
		if (this.snowing) {
			this.createSnowflakes();
			requestAnimationFrame(this.updateBound);
		}
	}

	onResize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
	}

	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.snowflakes = [];
	}

	createSnowflakes() {
		const flakes = window.innerWidth / 4;

		this.snowflakes = [];

		for (let s = 0; s < flakes; s++) {
			this.snowflakes.push(new Snowflake());
		}
	}

	update() {
		this.ctx.clearRect(0, 0, this.width, this.height);

		for (let flake of this.snowflakes) {
			flake.update();

			this.ctx.save();
			this.ctx.fillStyle = theme === "light" ? "#424242" : "#fff";
			this.ctx.beginPath();
			this.ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
			this.ctx.closePath();
			this.ctx.globalAlpha = flake.alpha;
			this.ctx.fill();
			this.ctx.restore();
		}

		if (this.snowing) {
			requestAnimationFrame(this.updateBound);
		} else {
			requestAnimationFrame(this.clearBound);
		}
	}
}

requestAnimationFrame(() => new Snow());
