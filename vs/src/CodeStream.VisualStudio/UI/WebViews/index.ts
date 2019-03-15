import { initialize, setupCommunication } from "@codestream/webview/index";

declare function acquireVsApi();

const vsApi = acquireVsApi();
const channel = new MessageChannel();

setupCommunication(channel.port2);

window.addEventListener(
    "message",
    message => {
        channel.port1.postMessage(message.data);
    },
    false
);
channel.port1.onmessage = message => {
    vsApi.postMessage(message.data);
};

initialize("#app");
