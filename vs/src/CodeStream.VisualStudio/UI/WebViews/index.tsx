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
                hasFocus: true
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

    //const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?/;

    //document.body.addEventListener(
    //    "click",
    //    function (e) {
    //        if (e == null || e.target == null || e.target.tagName !== "A") return;

    //        if (!vslsUrlRegex.test(e.target.href)) return;

    //        e.preventDefault();
    //        e.stopPropagation();
    //        e.stopImmediatePropagation();

    //        api.command(JoinLiveShareRequestType, {
    //            url: e.target.href
    //        });
    //    },
    //    true
    //);

    store.dispatch(actions.bootstrap(data)).then(() => {
        const duration = Date.now() - start;
        if (duration < 250) {
            setTimeout(doRender, 250 - duration);
        } else {
            doRender();
        }
    });
});
