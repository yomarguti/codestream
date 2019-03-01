"use strict";
import { LiveShareJoinSessionRequestType } from "@codestream/protocols/webview";
import { HostApi, initialize, setupCommunication } from "@codestream/webview/index";
import { initializeColorPalette } from "./theme";

declare function acquireVsCodeApi();

const vscodeApi = acquireVsCodeApi();
const channel = new MessageChannel();

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

setupCommunication(channel.port2);
initializeColorPalette();

const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?/;

document.body.addEventListener(
	"click",
	function(e) {
		if (e == null || e.target == null || (e.target as Element).tagName !== "A") return;

		if (!vslsUrlRegex.test((e.target as HTMLAnchorElement).href)) return;

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		HostApi.instance.send(LiveShareJoinSessionRequestType, {
			url: (e.target as HTMLAnchorElement).href
		});
	},
	true
);

const start = Date.now();
initialize("#app", {
	prerender: () =>
		setTimeout(() => {
			document.body.classList.remove("preload");
		}, 1000) // Wait for animations to complete
}).then(render => {
	const duration = Date.now() - start;
	if (duration < 250) {
		setTimeout(render, 250 - duration);
	} else {
		render();
	}
});
