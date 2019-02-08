import { shell } from "electron";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { Container } from "codestream-components";
import translations from "codestream-components/translations/en";
import { CompositeDisposable } from "atom";
import { WorkspaceSession } from "lib/workspace/workspace-session";
import { LoginResult } from "../../shared/api.protocol";
import {
	Target,
	CommandType,
	GoToSlackSignin,
	GoToSlackSigninResult,
	ValidateSignup,
	ValidateSignupResult,
} from "codestream-components/ipc/commands";

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

		this.setupWebviewListeners();
		this.render();
	}

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
		this.port.onmessage = ({ data }: { data: { id: string; command: CommandType } }) => {
			if (data.command.target === Target.Extension)
				this.handleWebviewCommand(data.id, data.command);
			if (data.command.target === Target.Agent) this.forwardWebviewCommand(data.id, data.command);
		};
	}
	private async forwardWebviewCommand(id: string, command: CommandType) {
		const response = await this.session.agent!.sendRequest(command.name, command.params);
		this.respond({ id, result: response });
	}

	private async handleWebviewCommand(id: string, command: CommandType) {
		switch (command.name) {
			case GoToSlackSignin.name: {
				const ok = shell.openExternal(
					`${
						this.session.environment.webAppUrl
					}/service-auth/slack?state=${this.session.getSignupToken()}`
				);
				if (ok) this.respond<GoToSlackSigninResult>({ id, result: true });
				else {
					this.respond({
						id,
						error: "No app found to open url",
					});
				}
				break;
			}
			case ValidateSignup.name: {
				const status = await this.session.loginViaSignupToken(command.params);
				if (status !== LoginResult.Success) this.respond({ id, error: status });
				else {
					const data = await this.session.getBootstrapData();
					this.respond<ValidateSignupResult>({ id, result: data });
				}
				break;
			}
			default: {
				debugger;
			}
		}
	}

	private respond<R = any>(message: { id: string; result: R } | { id: string; error: any }): void {
		this.port.postMessage(message);
	}
}
