import { shell } from "electron";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { Container, actions, listenForEvents } from "codestream-components";
import translations from "codestream-components/translations/en";
import { CompositeDisposable } from "atom";
import { WorkspaceSession } from "lib/workspace/workspace-session";
import { LoginResult } from "../../shared/api.protocol";
import {
	GoToSlackSignin,
	GoToSlackSigninResult,
	ValidateSignup,
	ValidateSignupResult,
} from "codestream-components/ipc/commands";
import { DataChangedEvent } from "codestream-components/ipc/events";
import { Target, IpcMessage, CommandMessage, EventType } from "codestream-components/ipc/common";
import { DidChangeDataNotification } from "../../shared/agent.protocol";

export const CODESTREAM_VIEW_URI = "atom://codestream";

export class CodestreamView {
	alive = false;
	element: HTMLElement;
	private session: WorkspaceSession;
	private store: any;
	private subscriptions: CompositeDisposable;
	private port: MessagePort;

	constructor(session: WorkspaceSession, port: MessagePort, store: any) {
		this.session = session;
		this.port = port;
		this.store = store;
		this.alive = true;
		this.subscriptions = new CompositeDisposable();
		this.element = document.createElement("div");
		this.element.classList.add("codestream");

		this.initialize();
		this.setupWebviewListeners();
		this.render();
	}

	private initialize() {
		this.session.getBootstrapData().then(bootstrapData => {
			this.store.dispatch(actions.bootstrap(bootstrapData));
		});

		// TODO: create a controller to house this stuff so it isn't re-init everytime this view is instantiated
		this.subscriptions.add(this.session.agent.onDidChangeData(this.onDidChangeSessionData));
	}

	private onDidChangeSessionData = (data: DidChangeDataNotification) => {
		this.sendEvent(DataChangedEvent, data);
	};

	private render() {
		render(
			<Container store={this.store} i18n={{ locale: "en", messages: translations }} />,
			this.element
		);
	}

	// update-able
	getTitle() {
		return "CodeStream";
	}

	// update-able
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
		listenForEvents(this.store);

		this.port.onmessage = ({ data }: { data: IpcMessage }) => {
			switch (data.type) {
				case "command": {
					if (data.target === Target.Extension) this.handleWebviewCommand(data);
					if (data.target === Target.Agent) this.forwardWebviewCommand(data);
					break;
				}
			}
		};
	}
	private async forwardWebviewCommand(command: CommandMessage) {
		const response = await this.session.agent!.sendRequest(command.name, command.params);
		this.respond({ id: command.id, result: response });
	}

	private async handleWebviewCommand(command: CommandMessage) {
		switch (command.name) {
			case GoToSlackSignin.name: {
				const ok = shell.openExternal(
					`${
						this.session.environment.webAppUrl
					}/service-auth/slack?state=${this.session.getSignupToken()}`
				);
				if (ok) this.respond<GoToSlackSigninResult>({ id: command.id, result: true });
				else {
					this.respond({
						id: command.id,
						error: "No app found to open url",
					});
				}
				break;
			}
			case ValidateSignup.name: {
				const status = await this.session.loginViaSignupToken(command.params);
				if (status !== LoginResult.Success) this.respond({ id: command.id, error: status });
				else {
					const data = await this.session.getBootstrapData();
					this.respond<ValidateSignupResult>({ id: command.id, result: data });
				}
				break;
			}
			default: {
				debugger;
			}
		}
	}

	private respond<R = any>(message: { id: string; result: R } | { id: string; error: any }): void {
		this.port.postMessage({
			...message,
			type: (message as any).error ? "command-result-error" : "command-result",
		});
	}

	private sendEvent<ET extends EventType<any>>(
		eventType: ET,
		params: ET extends EventType<infer P> ? P : never
	) {
		this.port.postMessage({ type: "event", name: eventType.name, params });
	}
}
