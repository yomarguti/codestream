"use strict";
import {
	ConnectionStatus,
	DidChangeConnectionStatusNotification,
	DidChangeConnectionStatusNotificationType,
	DidChangeDataNotification,
	DidChangeDataNotificationType,
	DidChangeDocumentMarkersNotification,
	DidChangeDocumentMarkersNotificationType,
	ReportingMessageType
} from "@codestream/protocols/agent";
import { CodemarkType, LoginResult } from "@codestream/protocols/api";
import {
	ApplyMarkerRequestType,
	BootstrapRequestType,
	CompareMarkerRequestType,
	CompleteSignupRequestType,
	EditorContext,
	EditorHighlightRangeRequestType,
	EditorRevealRangeRequestType,
	EditorRevealRangeResult,
	EditorSelectRangeRequestType,
	HostDidChangeActiveEditorNotificationType,
	HostDidChangeConfigNotificationType,
	HostDidChangeEditorSelectionNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	HostDidLogoutNotificationType,
	IpcRoutes,
	isIpcRequestMessage,
	isIpcResponseMessage,
	LiveShareInviteToSessionRequestType,
	LiveShareJoinSessionRequestType,
	LiveShareStartSessionRequestType,
	LoginRequestType,
	LogoutRequestType,
	NewCodemarkNotificationType,
	ReloadWebviewRequestType,
	ShowCodemarkNotificationType,
	SignedInBootstrapResponse,
	SignedOutBootstrapResponse,
	SignupRequestType,
	SlackLoginRequestType,
	UpdateConfigurationRequestType,
	WebviewContext,
	WebviewDidChangeContextNotificationType,
	WebviewDidInitializeNotificationType,
	WebviewIpcMessage,
	WebviewIpcNotificationMessage,
	WebviewIpcRequestMessage
} from "@codestream/protocols/webview";
import * as fs from "fs";
import {
	commands,
	ConfigurationChangeEvent,
	ConfigurationTarget,
	Disposable,
	TextDocument,
	TextEditor,
	TextEditorSelectionChangeEvent,
	TextEditorVisibleRangesChangeEvent,
	Uri,
	ViewColumn,
	window,
	workspace
} from "vscode";
import { NotificationType, RequestType } from "vscode-languageclient";
import {
	CodeStreamSession,
	SessionSignedOutReason,
	SessionStatus,
	SessionStatusChangedEvent,
	StreamThread
} from "../api/session";
import { WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { emptyObj } from "../constants";
import { Container } from "../container";
import { Editor } from "../extensions";
import { Logger } from "../logger";
import { Functions, log } from "../system";
import { CodeStreamWebviewPanel, toLoggableIpcMessage } from "../webviews/webviewPanel";

export interface WebviewState {
	hidden: boolean;
	teams: {
		[teamId: string]: {
			context?: WebviewContext;
		};
	};
}

export class WebviewController implements Disposable {
	// private _bootstrapPromise: Promise<BootstrapResponse> | undefined;
	private _context: WebviewContext | undefined;
	private _disposable: Disposable | undefined;
	private _disposableWebview: Disposable | undefined;
	private _webview: CodeStreamWebviewPanel | undefined;

	private readonly _notifyActiveEditorChangedDebounced: (e: TextEditor | undefined) => void;

	constructor(public readonly session: CodeStreamSession) {
		this._disposable = Disposable.from(
			this.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
			window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this),
			window.onDidChangeVisibleTextEditors(this.onVisibleEditorsChanged, this),
			workspace.onDidCloseTextDocument(this.onDocumentClosed, this)
		);

		this._lastEditor = Editor.getActiveOrVisible();

		this._notifyActiveEditorChangedDebounced = Functions.debounce(
			this.notifyActiveEditorChanged,
			100
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this.closeWebview();
	}

	private _lastEditor: TextEditor | undefined;
	private setLastEditor(editor: TextEditor | undefined) {
		this._lastEditor = editor;
		this._notifyActiveEditorChangedDebounced(editor);
	}

	private onActiveEditorChanged(e: TextEditor | undefined) {
		if (this._lastEditor !== undefined && e === undefined) return;
		if (this._lastEditor === e || (e !== undefined && !Editor.isTextEditor(e))) return;

		this.setLastEditor(e);
	}

	private onDocumentClosed(e: TextDocument) {
		if (this._lastEditor === undefined || e !== this._lastEditor.document) return;

		this.setLastEditor(undefined);
	}

	private async onSessionStatusChanged(e: SessionStatusChangedEvent) {
		const status = e.getStatus();
		switch (status) {
			case SessionStatus.SignedOut:
				if (e.reason === SessionSignedOutReason.SignInFailure) {
					if (!this.visible) {
						this.show();
					}
					break;
				}

				if (this.visible && e.reason === SessionSignedOutReason.UserSignedOut) {
					if (this._webview !== undefined) {
						this._webview.notify(HostDidLogoutNotificationType, {});
					}
					break;
				}

				this.closeWebview();
				break;

			case SessionStatus.SignedIn:
				this._lastEditor = Editor.getActiveOrVisible();

				const state = Container.context.workspaceState.get<WebviewState>(
					WorkspaceState.webviewState,
					{
						hidden: false,
						teams: {}
					}
				);
				const { context } = state.teams[this.session.team.id];
				this._context = context;

				if (!state.hidden) {
					this.show();
				}

				break;
		}
	}

	private onVisibleEditorsChanged(e: TextEditor[]) {
		if (this._lastEditor === undefined || e.includes(this._lastEditor)) return;

		this.setLastEditor(undefined);
	}

	get activeStreamThread() {
		if (this._context === undefined) {
			return undefined;
		}
		return {
			id: this._context.threadId,
			streamId: this._context.currentStreamId
		};
	}

	get viewColumn(): ViewColumn | undefined {
		return this._webview === undefined ? undefined : this._webview.viewColumn;
	}

	get visible() {
		return this._webview === undefined ? false : this._webview.visible;
	}

	@log()
	hide() {
		if (this._webview === undefined) return;

		this._webview.dispose();
	}

	@log()
	async newCodemarkRequest(type: CodemarkType, editor: TextEditor): Promise<void> {
		if (!this.visible) {
			await this.show();
		}

		// TODO: Change this to be a request vs a notification
		this._webview!.notify(NewCodemarkNotificationType, {
			uri: editor.document.uri.toString(false),
			range: Editor.toSerializableRange(editor.selection),
			type: type
		});
	}

	@log()
	async openCodemark(codemarkId: string, streamThread?: StreamThread): Promise<void> {
		if (streamThread !== undefined) {
			await this.show(streamThread);
			return;
		}

		if (!this.visible) {
			await this.show();
		}

		// TODO: Hook this up in the webview
		// TODO: Change this to be a request vs a notification
		this._webview!.notify(ShowCodemarkNotificationType, {
			codemarkId: codemarkId
		});
	}

	@log()
	reload() {
		if (this._webview === undefined || !this.visible) return;

		return this._webview.reload();
	}

	@log({
		args: false
	})
	async show(streamThread?: StreamThread) {
		if (this._webview === undefined) {
			if (streamThread === undefined) {
				streamThread = this.activeStreamThread as any;
			}

			// // Kick off the bootstrap compute to be ready for later
			// this._bootstrapPromise = this.getBootstrap();

			this._webview = new CodeStreamWebviewPanel(this.session, await this.getHtml());
			const webview = this._webview;

			this._disposableWebview = Disposable.from(
				this._webview.onDidClose(this.onWebviewClosed, this),
				this._webview.onDidMessageReceive(
					(...args) => this.onWebviewMessageReceived(webview, ...args),
					this
				),
				Container.agent.onDidChangeConnectionStatus(
					(...args) => this.onConnectionStatusChanged(webview, ...args),
					this
				),
				Container.agent.onDidChangeData((...args) => this.onDataChanged(webview, ...args), this),
				Container.agent.onDidChangeDocumentMarkers(
					(...args) => this.onDocumentMarkersChanged(webview, ...args),
					this
				),
				window.onDidChangeTextEditorSelection(
					Functions.debounce<(e: TextEditorSelectionChangeEvent) => any>(
						(...args) => this.onEditorSelectionChanged(webview, ...args),
						250,
						{
							maxWait: 250
						}
					),
					this
				),
				window.onDidChangeTextEditorVisibleRanges(
					(...args) => this.onEditorVisibleRangesChanged(webview, ...args),
					this
				),
				configuration.onDidChange((...args) => this.onConfigurationChanged(webview, ...args), this),

				// Keep this at the end otherwise the above subscriptions can fire while disposing
				this._webview
			);

			Container.agent.telemetry.track("Webview Opened");
		}

		await this._webview.show(streamThread);
		this.updateState();

		return this.activeStreamThread as StreamThread | undefined;
	}

	@log()
	toggle() {
		return this.visible ? this.hide() : this.show();
	}

	private async onConnectionStatusChanged(
		webview: CodeStreamWebviewPanel,
		e: DidChangeConnectionStatusNotification
	) {
		if (!webview.visible) return;

		switch (e.status) {
			case ConnectionStatus.Disconnected:
				// TODO: Handle this
				break;

			case ConnectionStatus.Reconnecting:
				webview.notify(DidChangeConnectionStatusNotificationType, e);
				break;

			case ConnectionStatus.Reconnected:
				if (e.reset) {
					void (await this.reload());

					return;
				}

				webview.notify(DidChangeConnectionStatusNotificationType, e);
				break;
		}
	}

	private onConfigurationChanged(webview: CodeStreamWebviewPanel, e: ConfigurationChangeEvent) {
		if (
			configuration.changed(e, configuration.name("avatars").value) ||
			configuration.changed(e, configuration.name("muteAll").value) ||
			configuration.changed(e, configuration.name("showMarkers").value) ||
			configuration.changed(e, configuration.name("traceLevel").value) ||
			configuration.changed(e, configuration.name("viewCodemarksInline").value)
		) {
			webview.notify(HostDidChangeConfigNotificationType, {
				debug: Container.config.traceLevel === "debug",
				muteAll: Container.config.muteAll,
				viewCodemarksInline: Container.config.viewCodemarksInline,
				serverUrl: this.session.serverUrl,
				showHeadshots: Container.config.avatars,
				showMarkers: Container.config.showMarkers
			});
		}
	}

	private onDataChanged(webview: CodeStreamWebviewPanel, e: DidChangeDataNotification) {
		webview.notify(DidChangeDataNotificationType, e);
	}

	private onDocumentMarkersChanged(
		webview: CodeStreamWebviewPanel,
		e: DidChangeDocumentMarkersNotification
	) {
		webview.notify(DidChangeDocumentMarkersNotificationType, e);
	}

	private async onEditorSelectionChanged(
		webview: CodeStreamWebviewPanel,
		e: TextEditorSelectionChangeEvent
	) {
		if (e.textEditor !== this._lastEditor) return;

		webview.notify(HostDidChangeEditorSelectionNotificationType, {
			uri: e.textEditor.document.uri.toString(),
			selections: Editor.toEditorSelections(e.selections),
			visibleRanges: Editor.toSerializableRange(e.textEditor.visibleRanges)
		});
	}

	private onEditorVisibleRangesChanged(
		webview: CodeStreamWebviewPanel,
		e: TextEditorVisibleRangesChangeEvent
	) {
		if (e.textEditor !== this._lastEditor) return;

		const uri = e.textEditor.document.uri;
		if (uri.scheme !== "file") return;

		webview.notify(HostDidChangeEditorVisibleRangesNotificationType, {
			uri: uri.toString(),
			selections: Editor.toEditorSelections(e.textEditor.selections),
			visibleRanges: Editor.toSerializableRange(e.visibleRanges)
		});
	}

	private onWebviewClosed() {
		this.closeWebview("user");
	}

	private async onWebviewMessageReceived(webview: CodeStreamWebviewPanel, e: WebviewIpcMessage) {
		try {
			Logger.log(`Webview: Received message ${toLoggableIpcMessage(e)} from the webview`);

			if (isIpcResponseMessage(e)) {
				webview.onCompletePendingIpcRequest(e);
				return;
			}

			const target = e.method.split("/")[0];
			switch (target) {
				case IpcRoutes.Agent:
					if (isIpcRequestMessage(e)) {
						webview.onIpcRequest(new RequestType<any, any, any, any>(e.method), e, (type, params) =>
							Container.agent.sendRequest(type, params)
						);

						return;
					}

					Container.agent.sendNotification(new NotificationType<any, any>(e.method), e.params);

					return;

				case IpcRoutes.Host:
					if (isIpcRequestMessage(e)) {
						this.onWebviewRequest(webview, e);

						return;
					}

					this.onWebviewNotification(webview, e);
			}
		} catch (ex) {
			debugger;
			Container.agent.reportMessage(ReportingMessageType.Error, ex.message);
			Logger.error(ex);
		}
	}

	private onWebviewNotification(webview: CodeStreamWebviewPanel, e: WebviewIpcNotificationMessage) {
		switch (e.method) {
			case WebviewDidInitializeNotificationType.method: {
				// view is rendered and ready to receive messages
				webview.onIpcReady();

				break;
			}
			case WebviewDidChangeContextNotificationType.method: {
				webview.onIpcNotification(WebviewDidChangeContextNotificationType, e, (type, params) => {
					this._context = params.context;
					this.updateState();
				});

				break;
			}
			default: {
				debugger;
				throw new Error(`Unhandled webview notification: ${e.method}`);
			}
		}
	}

	private async onWebviewRequest(webview: CodeStreamWebviewPanel, e: WebviewIpcRequestMessage) {
		switch (e.method) {
			case BootstrapRequestType.method: {
				Logger.log(`WebviewPanel: Bootstrapping webview...`, `SignedIn=${this.session.signedIn}`);

				webview.onIpcRequest(BootstrapRequestType, e, async (type, params) => this.getBootstrap());

				break;
			}
			case LoginRequestType.method: {
				webview.onIpcRequest(LoginRequestType, e, async (type, params) => {
					const { email, password } = params;

					let status: LoginResult;
					try {
						status = await this.session.login(email, password);
					} catch (ex) {
						throw new Error(LoginResult.Unknown);
					}
					if (status !== LoginResult.Success) throw new Error(status);

					return this.getBootstrap();
				});

				break;
			}
			case LogoutRequestType.method: {
				webview.onIpcRequest(LogoutRequestType, e, async (type, params) => {
					await Container.commands.signOut();
					return emptyObj;
				});

				break;
			}
			case SlackLoginRequestType.method: {
				webview.onIpcRequest(SlackLoginRequestType, e, async (type, params) => {
					await commands.executeCommand(
						"vscode.open",
						Uri.parse(
							`${
								Container.config.webAppUrl
							}/service-auth/slack?state=${this.session.getSignupToken()}`
						)
					);
					return emptyObj;
				});

				break;
			}
			case SignupRequestType.method: {
				webview.onIpcRequest(SignupRequestType, e, async (type, params) => {
					await commands.executeCommand(
						"vscode.open",
						Uri.parse(
							`${
								Container.config.webAppUrl
							}/signup?force_auth=true&signup_token=${this.session.getSignupToken()}`
						)
					);
					return emptyObj;
				});

				break;
			}
			case CompleteSignupRequestType.method: {
				webview.onIpcRequest(CompleteSignupRequestType, e, async (type, params) => {
					const status = await this.session.loginViaSignupToken(params.token);
					if (status !== LoginResult.Success) throw new Error(status);

					return this.getBootstrap();
				});

				break;
			}
			case EditorHighlightRangeRequestType.method: {
				webview.onIpcRequest(EditorHighlightRangeRequestType, e, async (type, params) => {
					void (await Editor.highlightRange(
						Uri.parse(params.uri),
						Editor.fromSerializableRange(params.range),
						!params.highlight
					));
					return {};
				});

				break;
			}
			case EditorRevealRangeRequestType.method: {
				webview.onIpcRequest(EditorRevealRangeRequestType, e, async (type, params) => {
					const result = await Editor.revealRange(
						Uri.parse(params.uri),
						Editor.fromSerializableRange(params.range),
						{
							preserveFocus: params.preserveFocus
						}
					);
					return {
						result: result ? EditorRevealRangeResult.Success : EditorRevealRangeResult.FileNotFound
					};
				});

				break;
			}
			case EditorSelectRangeRequestType.method: {
				webview.onIpcRequest(EditorSelectRangeRequestType, e, async (type, params) => {
					void (await Editor.selectRange(
						Uri.parse(params.uri),
						Editor.fromSerializableRange(params.range),
						{
							preserveFocus: params.preserveFocus
						}
					));
					return {};
				});

				break;
			}
			case ApplyMarkerRequestType.method: {
				webview.onIpcRequest(ApplyMarkerRequestType, e, async (type, params) => {
					void (await Container.commands.applyMarker({ marker: params.marker }));
					return emptyObj;
				});

				break;
			}
			case CompareMarkerRequestType.method: {
				webview.onIpcRequest(CompareMarkerRequestType, e, async (type, params) => {
					void (await Container.commands.showMarkerDiff({ marker: params.marker }));
					return emptyObj;
				});

				break;
			}
			case ReloadWebviewRequestType.method: {
				webview.onIpcRequest(ReloadWebviewRequestType, e, async (type, params) => this.reload());

				break;
			}
			case UpdateConfigurationRequestType.method: {
				webview.onIpcRequest(UpdateConfigurationRequestType, e, async (type, params) => {
					await configuration.update(params.name, params.value, ConfigurationTarget.Global);
					return emptyObj;
				});

				break;
			}
			case LiveShareInviteToSessionRequestType.method: {
				webview.onIpcRequest(LiveShareInviteToSessionRequestType, e, async (type, params) => {
					await Container.vsls.processRequest({
						type: "invite",
						userId: params.userId,
						createNewStream: params.createNewStream
					});
					return emptyObj;
				});

				break;
			}
			case LiveShareJoinSessionRequestType.method: {
				webview.onIpcRequest(LiveShareJoinSessionRequestType, e, async (type, params) => {
					await Container.vsls.processRequest({
						type: "join",
						url: params.url
					});
					return emptyObj;
				});

				break;
			}
			case LiveShareStartSessionRequestType.method: {
				webview.onIpcRequest(LiveShareStartSessionRequestType, e, async (type, params) => {
					await Container.vsls.processRequest({
						type: "start",
						streamId: params.streamId,
						threadId: params.threadId,
						createNewStream: params.createNewStream
					});
					return emptyObj;
				});

				break;
			}
			default: {
				debugger;
				throw new Error(`Unhandled webview request: ${e.method}`);
			}
		}
	}

	private closeWebview(reason?: "user") {
		try {
			if (reason === "user") {
				Container.agent.telemetry.track("Webview Closed");
			}
			this.updateState(reason === "user");
		} finally {
			if (this._disposableWebview !== undefined) {
				try {
					this._disposableWebview.dispose();
				} catch {}
				this._disposableWebview = undefined;
			}
			this._webview = undefined;
		}
	}

	private async getBootstrap<
		T extends SignedInBootstrapResponse | SignedOutBootstrapResponse
	>(): Promise<T> {
		if (!this.session.signedIn) {
			const state: SignedOutBootstrapResponse = {
				capabilities: this.session.capabilities,
				configs: { email: Container.config.email },
				env: this.session.environment,
				version: Container.versionFormatted
			};

			return state as T;
		}

		const context: WebviewContext = {
			...(this._context || emptyObj),
			currentTeamId: this.session.team.id,
			hasFocus: true
		};
		let editorContext: EditorContext = {};
		if (this._lastEditor !== undefined) {
			editorContext = {
				activeFile: workspace.asRelativePath(this._lastEditor.document.uri),
				metrics: Editor.getMetrics(),
				textEditorUri: Editor.getUriString(this._lastEditor),
				textEditorVisibleRanges: Editor.toSerializableRange(this._lastEditor.visibleRanges),
				textEditorSelections: Editor.toEditorSelections(this._lastEditor.selections)
			};
		}

		const bootstrapData = await Container.agent.bootstrap();

		const state: SignedInBootstrapResponse = {
			capabilities: this.session.capabilities,
			configs: {
				debug: Container.config.traceLevel === "debug",
				email: Container.config.email,
				muteAll: Container.config.muteAll,
				viewCodemarksInline: Container.config.viewCodemarksInline,
				serverUrl: this.session.serverUrl,
				showHeadshots: Container.config.avatars,
				showMarkers: Container.config.showMarkers
			},
			context: context,
			editorContext: editorContext,
			env: this.session.environment,
			session: {
				userId: this.session.userId
			},
			version: Container.versionFormatted,
			...bootstrapData
		};

		return state as T;
	}

	private _html: string | undefined;
	private async getHtml(): Promise<string> {
		let content;
		// When we are debugging avoid any caching so that we can change the html and have it update without reloading
		if (Logger.isDebugging) {
			content = await new Promise<string>((resolve, reject) => {
				fs.readFile(Container.context.asAbsolutePath("webview.html"), "utf8", (err, data) => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		} else {
			if (this._html !== undefined) return this._html;

			const doc = await workspace.openTextDocument(
				Container.context.asAbsolutePath("webview.html")
			);
			content = doc.getText();
		}

		this._html = content.replace(
			/{{root}}/g,
			Uri.file(Container.context.asAbsolutePath("."))
				.with({ scheme: "vscode-resource" })
				.toString()
		);
		return this._html;
	}

	private notifyActiveEditorChanged(e: TextEditor | undefined) {
		if (this._webview === undefined) return;

		if (e == null || e.document.uri.scheme !== "file") {
			this._webview.notify(HostDidChangeActiveEditorNotificationType, {});
			return;
		}

		const uri = e.document.uri;
		this._webview.notify(HostDidChangeActiveEditorNotificationType, {
			editor: {
				uri: uri.toString(),
				fileName: workspace.asRelativePath(uri),
				languageId: e.document.languageId,
				metrics: Editor.getMetrics(),
				selections: Editor.toEditorSelections(e.selections),
				visibleRanges: Editor.toSerializableRange(e.visibleRanges)
			}
		});
	}

	private updateState(hidden: boolean = false) {
		try {
			if (!this.session.signedIn) return;

			const prevState = Container.context.workspaceState.get<WebviewState>(
				WorkspaceState.webviewState,
				{
					hidden: hidden,
					teams: {}
				}
			);

			const teams = prevState.teams || {};
			teams[this.session.team.id] = {
				context: this._context
			};

			Container.context.workspaceState.update(WorkspaceState.webviewState, {
				hidden: hidden,
				teams: teams
			});
		} catch {}
	}
}
