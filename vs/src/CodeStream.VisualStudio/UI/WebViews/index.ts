import { initialize, setupCommunication } from "@codestream/webview/index";
import { initializeColorPalette } from "./theme";

declare function acquireVsApi();

const vscodeApi = acquireVsApi();
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

initialize("#app").then(render => {
	setTimeout(() => {
		document.body.classList.remove("preload");
	}, 1000); // Wait for animations to complete

	render();
});
