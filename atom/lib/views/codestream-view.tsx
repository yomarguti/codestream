import {
	BootstrapRequestType as WebviewBootstrapRequestType,
	BootstrapResponse,
	CompleteSignupRequestType,
	EditorContext,
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequest,
	EditorRevealRangeRequestType,
	EditorSelectRangeRequest,
	EditorSelectRangeRequestType,
	HostDidChangeActiveEditorNotification,
	HostDidChangeActiveEditorNotificationType,
	HostDidChangeConfigNotificationType,
	HostDidChangeEditorSelectionNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	HostDidChangeFocusNotificationType,
	HostDidLogoutNotificationType,
	isIpcRequestMessage,
	LoginRequest,
	LoginRequestType,
	LogoutRequestType,
	LogoutResponse,
	NewCodemarkNotificationType,
	ShowStreamNotificationType,
	SignedInBootstrapResponse,
	SlackLoginRequestType,
	SlackLoginResponse,
	UpdateConfigurationRequest,
	UpdateConfigurationRequestType,
	UpdateConfigurationResponse,
	WebviewContext,
	WebviewDidChangeContextNotificationType,
	WebviewDidInitializeNotificationType,
	WebviewIpcMessage,
	WebviewIpcNotificationMessage,
	WebviewIpcRequestMessage,
	WebviewPanels,
} from "@codestream/protocols/webview";
import { CompositeDisposable, Disposable, Emitter, Point, Range, TextEditor } from "atom";
import { Convert } from "atom-languageclient";
import { remote, shell } from "electron";
import { NotificationType } from "vscode-languageserver-protocol";
import { ConfigSchema } from "../configs";
import {
	BootstrapRequestType as AgentBootstrapRequestType,
	ConnectionStatus,
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotificationType,
	GetFileScmInfoRequestType,
} from "../protocols/agent/agent.protocol";
import { CodemarkType, LoginResult } from "../protocols/agent/api.protocol";
import { asAbsolutePath, Editor } from "../utils";
import { Container } from "../workspace/container";
import { WorkspaceEditorObserver } from "../workspace/editor-observer";
import { SessionStatus, WorkspaceSession } from "../workspace/workspace-session";
import { isViewVisible } from "./controller";
import { getStylesheets } from "./styles-getter";

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
export const WEBVIEW_DID_INITIALIZE = "webview-ready";
export const DID_CHANGE_STATE = "state-changed";
export const WILL_DESTROY = "will-destroy";

export class CodestreamView {
	element: HTMLElement;
	private session: WorkspaceSession;
	private subscriptions: CompositeDisposable;
	private channel: WebviewIpc;
	private iframe: HTMLIFrameElement;
	private emitter: Emitter;
	private webviewReady?: Promise<void>;
	private webviewContext: any;
	private editorSelectionObserver?: WorkspaceEditorObserver;

	constructor(session: WorkspaceSession, webviewContext: any) {
		this.session = session;
		this.webviewContext = webviewContext;
		this.channel = new WebviewIpc();
		this.emitter = new Emitter();
		this.subscriptions = new CompositeDisposable();
		this.element = document.createElement("div");
		this.element.classList.add("codestream");
		this.iframe = document.createElement("iframe");

		this.initializeWebview(this.iframe);
		this.initialize();
		this.setupWebviewListener();
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
		return 300;
	}

	getURI() {
		return CODESTREAM_VIEW_URI;
	}

	async show(streamId?: string, threadId?: string) {
		await atom.workspace.open(this, { activatePane: true });
		await this.webviewReady;
		if (streamId) {
			this.sendEvent(ShowStreamNotificationType, { streamId, threadId });
		}
	}

	private initializeWebview(iframe: HTMLIFrameElement) {
		iframe.height = "100%";
		iframe.width = "100%";
		iframe.style.border = "none";
		iframe.src = asAbsolutePath("dist/webview/index.html");

		iframe.classList.add("webview", "native-key-bindings");
		iframe.addEventListener("load", async () => {
			iframe.contentWindow!.postMessage(
				{
					label: "codestream-webview-initialize",
					styles: await getStylesheets(),
				},
				"*",
				[this.channel.webview]
			);

			iframe.contentWindow!.addEventListener("message", ({ data }: any) => {
				if (data.label === "open-link") {
					shell.openExternal(data.link);
				}
			});
		});

		this.subscriptions.add(
			atom.themes.onDidChangeActiveThemes(async () => {
				if (!iframe.contentWindow) return;
				iframe.contentWindow.postMessage(
					{ label: "update-styles", styles: await getStylesheets() },
					"*"
				);
			})
		);

		this.iframe = iframe;
		this.element.append(iframe);
	}

	private observeWorkspace() {
		this.editorSelectionObserver = new WorkspaceEditorObserver();
		this.editorSelectionObserver.onDidChangeSelection(this.onSelectionChanged);
		this.editorSelectionObserver.onDidChangeActiveEditor(this.onEditorActiveEditorChanged);
		this.editorSelectionObserver.onDidChangeVisibleRanges(editor => {
			this.sendEvent(HostDidChangeEditorVisibleRangesNotificationType, {
				uri: Editor.getUri(editor),
				selections: Editor.getCSSelections(editor),
				visibleRanges: Editor.getVisibleRanges(editor),
				lineCount: editor.getLineCount(),
			});
		});
	}

	private initialize() {
		const onBlur = () => this.sendEvent(HostDidChangeFocusNotificationType, { focused: false });
		const onFocus = () => this.sendEvent(HostDidChangeFocusNotificationType, { focused: true });
		const window = remote.getCurrentWindow();
		window.on("focus", onFocus);
		window.on("blur", onBlur);

		if (this.session.isSignedIn) this.observeWorkspace();

		this.subscriptions.add(
			new Disposable(() => {
				window.removeListener("blur", onBlur);
				window.removeListener("focus", onFocus);
			}),
			this.session.agent.onDidChangeData(data =>
				this.sendEvent(DidChangeDataNotificationType, data)
			),
			this.session.onDidChangeSessionStatus(change => {
				if (
					change.current === SessionStatus.SignedOut &&
					change.previous !== SessionStatus.SigningIn
				) {
					this.sendEvent(HostDidLogoutNotificationType, {});
					this.editorSelectionObserver && this.editorSelectionObserver.dispose();
				}
				if (change.current === SessionStatus.SignedIn) {
					this.observeWorkspace();
				}
			}),
			this.session.agent.onDidChangeDocumentMarkers(e =>
				this.sendEvent(DidChangeDocumentMarkersNotificationType, e)
			),
			Container.configs.onDidChangeWebviewConfig(changes =>
				this.sendEvent(HostDidChangeConfigNotificationType, changes)
			),
			this.session.agent.onDidChangeConnectionStatus(e => {
				switch (e.status) {
					case ConnectionStatus.Disconnected: {
						break;
					}
					case ConnectionStatus.Reconnecting: {
						this.sendEvent(DidChangeConnectionStatusNotificationType, e);
						break;
					}
					case ConnectionStatus.Reconnected: {
						if (e.reset) {
							this.destroy();
							// atom.workspace.paneForURI(CODESTREAM_VIEW_URI)!.destroy();
							atom.workspace.open(CODESTREAM_VIEW_URI);
							break;
						}
						this.sendEvent(DidChangeConnectionStatusNotificationType, e);
						break;
					}
				}
			})
		);

		this.webviewReady = new Promise(resolve =>
			this.subscriptions.add(
				this.emitter.on(WEBVIEW_DID_INITIALIZE, () => {
					resolve();
				})
			)
		);
	}

	serialize() {
		return {
			deserializer: "codestream/CodestreamView",
		};
	}

	destroy() {
		this.emitter.emit(WILL_DESTROY);
		this.element.remove();
		this.subscriptions.dispose();
		this.editorSelectionObserver && this.editorSelectionObserver.dispose();
	}

	onWillDestroy(cb: () => void) {
		return this.emitter.on(WILL_DESTROY, cb);
	}

	onDidChangeState(cb: (state: WebviewContext) => void) {
		return this.emitter.on(DID_CHANGE_STATE, cb);
	}

	checkToToggleMarkers() {
		const configs = Container.configs;
		if (configs.get("showMarkers") === true && configs.get("autoHideMarkers") === true) {
			if (this.webviewContext.panelStack[0] === WebviewPanels.CodemarksForFile) {
				if (isViewVisible(this.getURI())) {
					Container.markerDecorationProvider.disable();
				} else Container.markerDecorationProvider.enable();
			} else Container.markerDecorationProvider.enable();
		}
	}

	private async getSignedInBootstrapState(): Promise<SignedInBootstrapResponse> {
		await this.session.ready;
		const bootstrapData = await this.session.agent.request(AgentBootstrapRequestType, {});

		const editor = atom.workspace.getActiveTextEditor();
		let editorContext: EditorContext = {};
		if (editor) {
			const uri = Editor.getUri(editor);
			editorContext = {
				activeFile: Editor.getRelativePath(editor),
				textEditorUri: uri,
				textEditorVisibleRanges: Editor.getVisibleRanges(editor),
				textEditorSelections: Editor.getCSSelections(editor),
				scmInfo: await this.session.agent.request(GetFileScmInfoRequestType, { uri }),
			};
		}

		return {
			...this.session.getBootstrapInfo(),
			...bootstrapData,
			session: { userId: this.session.user!.id },
			context: { ...this.webviewContext, currentTeamId: this.session.teamId },
			editorContext,
		};
	}

	private setupWebviewListener() {
		this.channel.host.onmessage = ({ data }: { data: WebviewIpcMessage }) => {
			if (isIpcRequestMessage(data)) {
				const target = data.method.split("/")[0];
				if (target === "host") return this.handleWebviewCommand(data);
				return this.forwardWebviewRequest(data as any);
			} else this.onWebviewNotification(data as WebviewIpcNotificationMessage);
		};
	}

	private async forwardWebviewRequest(request: { id: string; method: string; params?: any }) {
		const response = await this.session.agent.sendRequest(request.method, request.params);
		this.respond({ id: request.id, params: response });
	}

	private async handleWebviewCommand(message: WebviewIpcRequestMessage) {
		switch (message.method) {
			case WebviewBootstrapRequestType.method: {
				try {
					await this.session.ready;
					const response: BootstrapResponse = this.session.isSignedIn
						? await this.getSignedInBootstrapState()
						: this.session.getBootstrapInfo();

					this.respond<BootstrapResponse>({
						id: message.id,
						params: response,
					});
				} catch (error) {
					this.respond({ id: message.id, error: error.message });
				}
				break;
			}
			case SlackLoginRequestType.method: {
				const ok = shell.openExternal(
					`${
						this.session.environment.webAppUrl
					}/service-auth/slack?state=${this.session.getSignupToken()}`
				);
				if (ok) this.respond<SlackLoginResponse>({ id: message.id, params: true });
				else {
					this.respond({
						id: message.id,
						error: "No app found to open url",
					});
				}
				break;
			}
			case CompleteSignupRequestType.method: {
				const status = await this.session.loginViaSignupToken(message.params);
				if (status !== LoginResult.Success) this.respond({ id: message.id, error: status });
				else {
					const data = await this.getSignedInBootstrapState();
					this.respond<SignedInBootstrapResponse>({ id: message.id, params: data });
				}
				break;
			}
			case LoginRequestType.method: {
				const params: LoginRequest = message.params;
				const status = await this.session.login(params.email, params.password);
				if (status !== LoginResult.Success) this.respond({ id: message.id, error: status });
				else {
					const data = await this.getSignedInBootstrapState();
					this.respond<SignedInBootstrapResponse>({ id: message.id, params: data });
				}
				break;
			}
			case UpdateConfigurationRequestType.method: {
				const { name, value }: UpdateConfigurationRequest = message.params;
				if (Container.configs.isUserSetting(name)) {
					Container.configs.set(name as keyof ConfigSchema, value);
				}
				this.respond<UpdateConfigurationResponse>({ id: message.id, params: {} });
				this.sendEvent(HostDidChangeConfigNotificationType, { [name]: value });
				break;
			}
			case EditorHighlightRangeRequestType.method: {
				const { uri, highlight, range } = message.params;
				this.editorSelectionObserver!.highlight(
					highlight,
					Convert.uriToPath(uri),
					Convert.lsRangeToAtomRange(range)
				);
				break;
			}
			case EditorSelectRangeRequestType.method: {
				const { selection, uri, preserveFocus }: EditorSelectRangeRequest = message.params;

				await this.editorSelectionObserver!.select(
					Convert.uriToPath(uri),
					Convert.lsRangeToAtomRange(selection)
				);

				// TODO: revisit this because it doesn't actually work
				if (preserveFocus) {
					const pane = atom.workspace.paneContainerForURI(CODESTREAM_VIEW_URI);
					if (pane) (pane.getActivePaneItem() as any).focus();
				}
				break;
			}
			case EditorRevealRangeRequestType.method: {
				const { uri, range } = message.params as EditorRevealRangeRequest;
				atom.workspace.getTextEditors().some(editor => {
					if (editor.getPath() === Convert.uriToPath(uri)) {
						// TODO: compute the scroll position that will make `range.start.row` the first visible line
						editor.scrollToBufferPosition(Convert.lsRangeToAtomRange(range).start);
						return true;
					}
					return false;
				});
				break;
			}
			case LogoutRequestType.method: {
				this.session.signOut();
				this.respond<LogoutResponse>({ id: message.id, params: {} });
				break;
			}
			// case Logout
			// case ReloadWebviewRequestType.method: {
			// 	new Promise(() => {
			// 		this.destroy();
			// 		atom.commands.dispatch(document.querySelector("atom-workspace")!, "codestream:toggle");
			// 	});
			// 	break;
			// }
			default: {
				atom.notifications.addWarning(`Unhandled webview message: ${message.method}`);
				console.warn("unhandled webview message", message);
			}
		}
	}

	private onWebviewNotification(event: WebviewIpcNotificationMessage) {
		switch (event.method) {
			case WebviewDidInitializeNotificationType.method: {
				this.emitter.emit(WEBVIEW_DID_INITIALIZE);
				break;
			}
			case WebviewDidChangeContextNotificationType.method: {
				this.webviewContext = event.params.context;
				this.emitter.emit(DID_CHANGE_STATE, event.params.context);
				this.checkToToggleMarkers();
				break;
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

	newCodemarkRequest(type: CodemarkType, source?: string) {
		const editor = atom.workspace.getActiveTextEditor();
		if (editor === undefined) return;

		const uri = Editor.getUri(editor);
		const range = Editor.getCurrentSelectionRange(editor);
		this.sendEvent(NewCodemarkNotificationType, { type, uri, range, source });
		editor.setSelectedBufferRange(Convert.lsRangeToAtomRange(range));
	}

	private onSelectionChanged = (event: { editor: TextEditor; range: Range; cursor: Point }) => {
		this.sendEvent(HostDidChangeEditorSelectionNotificationType, {
			uri: Editor.getUri(event.editor),
			selections: Editor.getCSSelections(event.editor),
			visibleRanges: Editor.getVisibleRanges(event.editor),
		});
	}

	private onEditorActiveEditorChanged = (editor?: TextEditor) => {
		const notification: HostDidChangeActiveEditorNotification = {};
		const fileName = editor && Editor.getRelativePath(editor);
		if (editor) {
			notification.editor = {
				fileName: fileName || "",
				uri: Editor.getUri(editor),
				visibleRanges: Editor.getVisibleRanges(editor),
				selections: Editor.getCSSelections(editor),
				metrics: {
					lineHeight: editor.getLineHeightInPixels(),
					fontSize: atom.config.get("editor.fontSize"),
				},
			};
		}
		this.sendEvent(HostDidChangeActiveEditorNotificationType, notification);
	}
}
