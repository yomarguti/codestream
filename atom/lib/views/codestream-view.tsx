import { shell } from "electron";
import { CompositeDisposable } from "atom";
import { WorkspaceSession } from "../workspace/workspace-session";
import { LoginResult } from "../protocols/agent/api.protocol";
import { DidChangeDataNotification } from "../protocols/agent/agent.protocol";
import {
	DidChangeDataNotification as WebviewDidChangeDataNotification,
	WebviewIpcMessage,
	GetViewBootstrapDataRequestType,
	GetViewBootstrapDataResponse,
	GoToSlackSigninRequestType,
	GoToSlackSigninResponse,
	ValidateSignupRequestType,
	WebviewReadyNotificationType,
} from "../protocols/webview/webview.protocol";
import { asAbsolutePath } from "../utils";
import { getStyles } from "./styles-getter";
import { NotificationType } from "../protocols/webview/webview.protocol";

export class WebviewIpc {
	private channel: MessageChannel;

	constructor() {
		this.channel = new MessageChannel();
	}

	get host() {
		return this.channel.port1;
	}

	get webview() {
		return this.channel.port2;
	}
}

export const CODESTREAM_VIEW_URI = "atom://codestream";

export class CodestreamView {
	alive = false;
	element: HTMLElement;
	private session: WorkspaceSession;
	private subscriptions: CompositeDisposable;
	private channel: WebviewIpc;
	private iframe: HTMLIFrameElement;
	loadingSpinner: HTMLDivElement;

	constructor(session: WorkspaceSession) {
		this.session = session;
		this.channel = new WebviewIpc();
		this.alive = true;
		this.subscriptions = new CompositeDisposable();
		this.element = document.createElement("div");
		this.element.classList.add("codestream", "preload");
		this.iframe = document.createElement("iframe");
		this.loadingSpinner = this.setupLoadingSpinner();

		this.initializeWebview(this.iframe);
		this.initialize();
		this.setupWebviewListeners();
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
		// save this as a preference?
		return 300;
	}

	getURI() {
		return CODESTREAM_VIEW_URI;
	}

	private setupLoadingSpinner() {
		const loaderRing = document.createElement("div");
		loaderRing.innerHTML = `
			<div class="loader-ring">
				<div class="loader-ring__segment"></div>
				<div class="loader-ring__segment"></div>
				<div class="loader-ring__segment"></div>
				<div class="loader-ring__segment"></div>
			</div>
		`;
		this.element.appendChild(loaderRing);

		return loaderRing;
	}

	private removeLoadingSpinner() {
		this.element.removeChild(this.loadingSpinner);
	}

	private initializeWebview(iframe: HTMLIFrameElement) {
		iframe.height = "100%";
		iframe.width = "100%";
		iframe.style.border = "none";
		iframe.src = asAbsolutePath("dist/webview/index.html");

		iframe.classList.add("webview");
		iframe.addEventListener("load", () => {
			this.iframe.contentWindow!.postMessage(
				{
					label: "codestream-webview-initialize",
					styles: getStyles(),
				},
				"*",
				[this.channel.webview]
			);
		});

		this.iframe = iframe;
		this.element.append(iframe);
	}

	private initialize() {
		// TODO: create a controller to house this stuff so it isn't re-init everytime this view is instantiated
		this.subscriptions.add(
			this.session.agent.onInitialized(() => {
				this.subscriptions.add(this.session.agent.onDidChangeData(this.onDidChangeSessionData));
			})
		);
	}

	private onDidChangeSessionData = (data: DidChangeDataNotification) => {
		this.sendEvent(WebviewDidChangeDataNotification, data as any /* huh? */);
	};

	serialize() {
		return {
			deserializer: "codestream/CodestreamView",
		};
	}

	destroy() {
		this.element.remove();
		this.alive = false;
		this.subscriptions.dispose();
	}

	private setupWebviewListeners() {
		this.channel.host.onmessage = ({ data }: { data: WebviewIpcMessage }) => {
			const target = data.method.split("/")[0];
			if (target === "codeStream") return this.forwardWebviewRequest(data as any);
			if (data.id) return this.handleWebviewCommand(data as WebviewIpcMessage & { id: string });
		};
	}

	private async forwardWebviewRequest(request: { id: string; method: string; params?: any }) {
		const response = await this.session.agent!.sendRequest(request.method, request.params);
		this.respond({ id: request.id, params: response });
	}

	private async handleWebviewCommand<C extends WebviewIpcMessage & { id: string }>(message: C) {
		switch (message.method) {
			case WebviewReadyNotificationType.method: {
				this.removeLoadingSpinner();
				break;
			}
			case GetViewBootstrapDataRequestType.method: {
				try {
					const data = await this.session.getBootstrapData();
					this.respond<GetViewBootstrapDataResponse>({ id: message.id, params: data });
				} catch (error) {
					this.respond({ id: message.id, error: error.message });
				}
				break;
			}
			case GoToSlackSigninRequestType.method: {
				const ok = shell.openExternal(
					`${
						this.session.environment.webAppUrl
					}/service-auth/slack?state=${this.session.getSignupToken()}`
				);
				if (ok) this.respond<GoToSlackSigninResponse>({ id: message.id, params: true });
				else {
					this.respond({
						id: message.id,
						error: "No app found to open url",
					});
				}
				break;
			}
			case ValidateSignupRequestType.method: {
				const status = await this.session.loginViaSignupToken(message.params);
				if (status !== LoginResult.Success) this.respond({ id: message.id, error: status });
				else {
					const data = await this.session.getBootstrapData();
					this.respond<GetViewBootstrapDataResponse>({ id: message.id, params: data });
				}
				break;
			}
			default: {
				console.warn("unhandled webview message", message);
			}
		}
	}

	private respond<R = any>(message: { id: string; params: R } | { id: string; error: any }): void {
		this.channel.host.postMessage(message);
	}

	private sendEvent<ET extends NotificationType<any, any>>(
		eventType: ET,
		params: ET extends NotificationType<infer P, any> ? P : never
	) {
		this.channel.host.postMessage({ method: eventType.method, params });
	}
}
