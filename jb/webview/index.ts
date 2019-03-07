import { LiveShareJoinSessionRequestType } from "@codestream/protocols/webview";
import { HostApi, initialize, setupCommunication } from "@codestream/webview/index";
import { initializeColorPalette } from "./theme";

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


initializeColorPalette();

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