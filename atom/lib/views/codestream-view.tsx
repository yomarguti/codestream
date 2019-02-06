import { shell } from "electron";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { Container } from "codestream-components";
import { EventEmitter, IpcRequest as WebviewIpcRequest } from "codestream-components/event-emitter";
import translations from "codestream-components/translations/en";
import { CompositeDisposable } from "atom";
import { WorkspaceSession } from "lib/workspace/workspace-session";
import { LoginResult } from "../shared/api.protocol";

export const CODESTREAM_VIEW_URI = "atom://codestream";

export class CodestreamView {
	alive = false;
	element: HTMLElement;
	private session: WorkspaceSession;
	private store: any;
	private subscriptions: CompositeDisposable;

	constructor(session: WorkspaceSession, store: any) {
		this.session = session;
		this.store = store;
		this.alive = true;
		this.subscriptions = new CompositeDisposable();
		this.element = document.createElement("div");
		this.element.classList.add("codestream");

		this.setupWebviewListeners();
		this.render();
	}

	private render() {
		render(
			<Container store={this.store} i18n={{ locale: "en", messages: translations }} />,
			this.element
		);
	}

	getTitle() {
		return "CodeStream";
	}

	getIconName() {
		return "comment-discussion";
	}

	getDefaultLocation() {
		return "right";
	}

	getAllowedLocations() {
		return ["right", "left"];
	}

	isPermanentDockItem() {
		return false;
	}

	getPreferredWidth() {
		// FIXME save this as a preference
		return 300;
	}

	getURI() {
		return CODESTREAM_VIEW_URI;
	}

	serialize() {
		return {
			deserializer: "codestream/CodestreamView",
		};
	}

	destroy() {
		unmountComponentAtNode(this.element);
		this.element.remove();
		this.alive = false;
		this.subscriptions.dispose();
	}

	private setupWebviewListeners() {
		this.subscriptions.add(
			EventEmitter.on("request", this.handleWebviewRequest)
			// EventEmitter.on("analytics", ({ label, payload }) => mixpanel.track(label, payload)),
		);
	}

	private handleWebviewRequest = async (request: WebviewIpcRequest) => {
		switch (request.action) {
			case "go-to-slack-signin": {
				const ok = shell.openExternal(
					`${
						this.session.environment.webAppUrl
					}/service-auth/slack?state=${this.session.getSignupToken()}`
				);
				if (ok) EventEmitter.emit("response", { id: request.id, payload: true });
				else {
					console.error("Error opening browser");
					EventEmitter.emit("response", { id: request.id, error: "No app found to open url" });
				}
				break;
			}
			case "validate-signup": {
				const status = await this.session.loginViaSignupToken();
				if (status !== LoginResult.Success)
					EventEmitter.emit("response", { id: request.id, error: status });
				else {
					const data = await this.session.getBootstrapData();
					EventEmitter.emit("response", { id: request.id, payload: data });
				}
				break;
			}
			default: {
				debugger;
			}
		}
	};
}
