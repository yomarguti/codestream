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
import { LoginResult } from "@codestream/protocols/api";
import {
	ApplyMarkerRequestType,
	BootstrapRequestType,
	CompareMarkerRequestType,
	CompleteSignupRequestType,
	EditorHighlightLineRequestType,
	EditorHighlightMarkerRequestType,
	EditorRevealLineRequestType,
	EditorRevealMarkerRequestType,
	HostDidChangeActiveEditorNotificationType,
	HostDidChangeConfigNotificationType,
	HostDidChangeEditorSelectionNotificationType,
	HostDidChangeEditorVisibleRangesNotificationType,
	HostDidLogoutNotificationType,
	HostDidSelectCodeNotificationType,
	IpcRoutes,
	isIpcRequestMessage,
	isIpcResponseMessage,
	LiveShareInviteToSessionRequestType,
	LiveShareJoinSessionRequestType,
	LiveShareStartSessionRequestType,
	LoginRequestType,
	LogoutRequestType,
	ReloadWebviewRequestType,
	SignedInBootstrapResponse,
	SignedOutBootstrapResponse,
	SignupRequestType,
	SlackLoginRequestType,
	StartCommentOnLineRequestType,
	UpdateConfigurationRequestType,
	WebviewContext,
	WebviewDidChangeActiveStreamNotificationType,
	WebviewDidChangeContextNotificationType,
	WebviewDidCloseThreadNotificationType,
	WebviewDidInitializeNotificationType,
	WebviewDidOpenThreadNotificationType,
	WebviewIpcMessage,
	WebviewIpcNotificationMessage,
	WebviewIpcRequestMessage
} from "@codestream/protocols/webview";
import * as fs from "fs";
import * as path from "path";
import {
	commands,
	ConfigurationChangeEvent,
	ConfigurationTarget,
	Disposable,
	TextEditor,
	TextEditorSelectionChangeEvent,
	TextEditorVisibleRangesChangeEvent,
	Uri,
	ViewColumn,
	window,
	workspace
} from "vscode";
import { NotificationType, Range, RequestType } from "vscode-languageclient";
import {
	CodeStreamSession,
	SessionSignedOutReason,
	SessionStatus,
	SessionStatusChangedEvent,
	StreamThread
} from "../api/session";
import { selectionsToEditorSelections, WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions, log } from "../system";
import { CodeStreamWebviewPanel, toLoggableIpcMessage } from "../webviews/webviewPanel";

export interface StreamThreadId {
	id: string | undefined;
	streamId: string;
}

export interface WebviewState {
	hidden: boolean;
	streamThread?: StreamThreadId;
}

const empty = {};

export class WebviewController implements Disposable {
	// private _bootstrapPromise: Promise<BootstrapResponse> | undefined;
	private _context: WebviewContext | undefined;
	private _disposable: Disposable | undefined;
	private _disposableWebview: Disposable | undefined;
	private _lastStreamThread: StreamThread | undefined;
	private _webview: CodeStreamWebviewPanel | undefined;

	constructor(public readonly session: CodeStreamSession) {
		this._disposable = Disposable.from(
			this.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this.closeWebview();
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
				const state = {
					hidden: false,
					...(Container.context.workspaceState.get<WebviewState>(WorkspaceState.webviewState) ||
						empty)
				} as WebviewState;

				if (state.streamThread !== undefined) {
					const stream = await this.session.getStream(state.streamThread.streamId);
					this._lastStreamThread =
						stream !== undefined ? { id: state.streamThread.id, stream: stream } : undefined;
				}

				if (!state.hidden) {
					this.show(this._lastStreamThread);
				}
				break;
		}
	}

	get activeStreamThread() {
		if (this._webview === undefined) return undefined;

		return this._webview.streamThread;
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

	async postCode(
		code: string,
		uri: Uri,
		range: Range,
		source?: {
			file: string;
			repoPath: string;
			revision: string;
			authors: { id: string; username: string }[];
			remotes: { name: string; url: string }[];
		},
		gitError?: string,
		isHighlight?: boolean,
		type?: string
	) {
		await this.show();

		let file;
		if (source === undefined) {
			const folder = workspace.getWorkspaceFolder(uri);
			if (folder !== undefined) {
				file = path.relative(folder.uri.fsPath, uri.fsPath);
			}
		} else {
			file = source.file;
		}

		this._webview!.notify(HostDidSelectCodeNotificationType, {
			code: code,
			file: file,
			fileUri: uri.toString(),
			range: range,
			source: source,
			gitError: gitError,
			isHighlight: isHighlight,
			type: type
		});

		return this._lastStreamThread;
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
				streamThread = this._lastStreamThread;
				// streamThread = this._lastStreamThread || {
				// 	id: undefined,
				// 	stream: await this.session.getDefaultTeamChannel()
				// };
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
				window.onDidChangeActiveTextEditor(
					Functions.debounce<(e: TextEditor | undefined) => any>(
						(...args) => this.onActiveEditorChanged(webview, ...args),
						100
					),
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

		this._lastStreamThread = await this._webview.show(streamThread);
		this.updateState(this._lastStreamThread);

		return this._lastStreamThread;
	}

	@log()
	toggle() {
		return this.visible ? this.hide() : this.show();
	}

	private async onActiveEditorChanged(
		webview: CodeStreamWebviewPanel,
		editor: TextEditor | undefined
	) {
		if (editor == null || editor.document.uri.scheme !== "file") {
			return webview.notify(HostDidChangeActiveEditorNotificationType, {});
		}

		const uri = editor.document.uri;
		const { stream } = await Container.agent.streams.getFileStream(uri.toString());

		const folder = workspace.getWorkspaceFolder(uri);
		const fileName =
			folder !== undefined
				? path.relative(folder.uri.fsPath, uri.fsPath)
				: editor.document.fileName;

		webview.notify(HostDidChangeActiveEditorNotificationType, {
			editor: {
				fileStreamId: stream && stream.id,
				uri: uri.toString(),
				fileName: fileName,
				languageId: editor.document.languageId,
				selections: selectionsToEditorSelections(editor.selections),
				visibleRanges: editor.visibleRanges
			}
		});
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
			configuration.changed(e, configuration.name("viewCodemarksInline").value) ||
			configuration.changed(e, configuration.name("showMarkers").value) ||
			configuration.changed(e, configuration.name("openCommentOnSelect").value) ||
			configuration.changed(e, configuration.name("traceLevel").value)
		) {
			webview.notify(HostDidChangeConfigNotificationType, {
				debug: Container.config.traceLevel === "debug",
				muteAll: Container.config.muteAll,
				viewCodemarksInline: Container.config.viewCodemarksInline,
				serverUrl: this.session.serverUrl,
				showHeadshots: Container.config.avatars,
				showMarkers: Container.config.showMarkers,
				openCommentOnSelect: Container.config.openCommentOnSelect
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
		webview.notify(HostDidChangeEditorSelectionNotificationType, {
			uri: e.textEditor.document.uri.toString(),
			selections: selectionsToEditorSelections(e.selections),
			visibleRanges: e.textEditor.visibleRanges
		});

		// if (e.selections.length === 0) return;

		// const selection = e.selections[0];
		// if (selection.start.isEqual(selection.end)) return;

		// const uri = e.textEditor.document.uri;

		// const response = await Container.agent.posts.prepareCode(e.textEditor.document, selection);
		// await Container.webview.postCode(
		// 	response.code,
		// 	uri,
		// 	response.range,
		// 	response.source,
		// 	response.gitError,
		// 	true
		// );
	}

	private onEditorVisibleRangesChanged(
		webview: CodeStreamWebviewPanel,
		e: TextEditorVisibleRangesChangeEvent
	) {
		if (e.textEditor !== window.activeTextEditor) return;

		const uri = e.textEditor.document.uri;
		if (uri.scheme !== "file") return;

		webview.notify(HostDidChangeEditorVisibleRangesNotificationType, {
			uri: uri.toString(),
			selections: selectionsToEditorSelections(e.textEditor.selections),
			visibleRanges: e.visibleRanges
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
			case WebviewDidChangeActiveStreamNotificationType.method: {
				webview.onIpcNotification(
					WebviewDidChangeActiveStreamNotificationType,
					e,
					async (type, params) => {
						if (!params.streamId) {
							if (this._lastStreamThread !== undefined) {
								this._lastStreamThread = undefined;

								this.updateState(this._lastStreamThread);
							}

							return;
						}
						const stream = await this.session.getStream(params.streamId);
						if (stream !== undefined) {
							this._lastStreamThread = { id: undefined, stream: stream };
							this.updateState(this._lastStreamThread);
						}
					}
				);

				break;
			}
			case WebviewDidChangeContextNotificationType.method: {
				webview.onIpcNotification(WebviewDidChangeContextNotificationType, e, (type, params) => {
					this._context = params.context;
				});

				break;
			}
			case WebviewDidOpenThreadNotificationType.method: {
				webview.onIpcNotification(WebviewDidOpenThreadNotificationType, e, (type, params) => {
					if (
						this._lastStreamThread !== undefined &&
						this._lastStreamThread.stream.id === params.streamId
					) {
						this._lastStreamThread.id = params.threadId;
						this.updateState(this._lastStreamThread);
					}
				});
				break;
			}
			case WebviewDidCloseThreadNotificationType.method: {
				webview.onIpcNotification(WebviewDidCloseThreadNotificationType, e, (type, params) => {
					if (this._lastStreamThread !== undefined) {
						this._lastStreamThread.id = undefined;
						this.updateState(this._lastStreamThread);
					}
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
					return empty;
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
					return empty;
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
					return empty;
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
			case EditorHighlightLineRequestType.method: {
				webview.onIpcRequest(EditorHighlightLineRequestType, e, async (type, params) => {
					const result = await Container.commands.highlightLine(
						params.line,
						Uri.parse(params.uri),
						{
							onOff: params.highlight
						}
					);
					return { result: result };
				});

				break;
			}
			case EditorHighlightMarkerRequestType.method: {
				webview.onIpcRequest(EditorHighlightMarkerRequestType, e, async (type, params) => {
					const result = await Container.commands.highlightCode(params.marker, {
						onOff: params.highlight
					});
					return { result: result! };
				});

				break;
			}
			case EditorRevealLineRequestType.method: {
				webview.onIpcRequest(EditorRevealLineRequestType, e, async (type, params) => {
					commands.executeCommand("revealLine", { lineNumber: params.line, at: "top" });
					return empty;
				});

				break;
			}
			case EditorRevealMarkerRequestType.method: {
				webview.onIpcRequest(EditorRevealMarkerRequestType, e, async (type, params) => {
					const result = await Container.commands.openPostWorkingFile(params.marker, {
						preserveFocus: params.preserveFocus
					});
					return { result: result! };
				});

				break;
			}
			case ApplyMarkerRequestType.method: {
				webview.onIpcRequest(ApplyMarkerRequestType, e, async (type, params) => {
					void (await Container.commands.applyMarker({ marker: params.marker }));
					return empty;
				});

				break;
			}
			case CompareMarkerRequestType.method: {
				webview.onIpcRequest(CompareMarkerRequestType, e, async (type, params) => {
					void (await Container.commands.showMarkerDiff({ marker: params.marker }));
					return empty;
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
					return empty;
				});

				break;
			}
			case StartCommentOnLineRequestType.method: {
				webview.onIpcRequest(StartCommentOnLineRequestType, e, async (type, params) => {
					await Container.commands.startCommentOnLine({
						line: params.line,
						uri: params.uri,
						type: params.type
					});
					return empty;
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
					return empty;
				});

				break;
			}
			case LiveShareJoinSessionRequestType.method: {
				webview.onIpcRequest(LiveShareJoinSessionRequestType, e, async (type, params) => {
					await Container.vsls.processRequest({
						type: "join",
						url: params.url
					});
					return empty;
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
					return empty;
				});

				break;
			}
			default: {
				debugger;
				throw new Error(`Unhandled webview request: ${e.method}`);
			}
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
				showMarkers: Container.config.showMarkers,
				openCommentOnSelect: Container.config.openCommentOnSelect
			},
			context: {
				...(this._context || empty),
				currentTeamId: this.session.team.id,
				hasFocus: true
			},
			env: this.session.environment,
			session: {
				userId: this.session.userId
			},
			version: Container.versionFormatted,
			...bootstrapData
		};

		if (this._lastStreamThread !== undefined) {
			state.context.currentStreamId = this._lastStreamThread.stream.id;
			state.context.threadId = this._lastStreamThread.id;
		}

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
	private closeWebview(reason?: "user") {
		if (reason === "user") {
			Container.agent.telemetry.track("Webview Closed");
		}
		this.updateState(this.activeStreamThread, reason === "user");

		if (this._disposableWebview !== undefined) {
			this._disposableWebview.dispose();
			this._disposableWebview = undefined;
		}
		this._webview = undefined;
	}

	private updateState(streamThread: StreamThread | undefined, hidden: boolean = false) {
		this._lastStreamThread = streamThread;

		let streamThreadId: StreamThreadId | undefined;
		if (streamThread !== undefined) {
			streamThreadId = { id: streamThread.id, streamId: streamThread.stream.id };
		}
		Container.context.workspaceState.update(WorkspaceState.webviewState, {
			hidden: hidden,
			streamThread: streamThreadId
		} as WebviewState);
	}
}
