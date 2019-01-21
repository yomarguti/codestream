"use strict";
import * as fs from "fs";
import * as path from "path";
import {
	commands,
	ConfigurationChangeEvent,
	ConfigurationTarget,
	Disposable,
	Event,
	EventEmitter,
	Range,
	TextEditor,
	TextEditorSelectionChangeEvent,
	TextEditorVisibleRangesChangeEvent,
	Uri,
	ViewColumn,
	WebviewPanel,
	WebviewPanelOnDidChangeViewStateEvent,
	window,
	WindowState,
	workspace
} from "vscode";
import { RequestType } from "vscode-jsonrpc";
import {
	CSCodeBlock,
	CSMePreferences,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUnreads,
	CSUser,
	LoginResult
} from "../agent/agentConnection";
import {
	CodemarksChangedEvent,
	CodeStreamEnvironment,
	CodeStreamSession,
	PostsChangedEvent,
	PreferencesChangedEvent,
	RepositoriesChangedEvent,
	SessionChangedEventType,
	StreamsChangedEvent,
	StreamThread,
	TeamsChangedEvent,
	UnreadsChangedEvent,
	UsersChangedEvent
} from "../api/session";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	ApiCapabilities,
	ConnectionStatus,
	ReportingMessageType,
	TraceLevel
} from "../shared/agent.protocol";
import { log } from "../system";
import { Functions } from "../system";
import {
	DidScrollNotification,
	DidSelectCodeNotification,
	toLoggableIpcMessage,
	WebviewIpc,
	WebviewIpcMessage,
	WebviewIpcMessageResponseBody,
	WebviewIpcMessageType
} from "./webviewIpc";

interface BootstrapState {
	context?: {
		[key: string]: any;
	};
	capabilities?: ApiCapabilities;
	currentTeamId: string;
	currentUserId: string;
	currentStreamId: string;
	currentThreadId?: string;
	env: CodeStreamEnvironment | string;
	posts: CSPost[];
	streams: CSStream[];
	teams: CSTeam[];
	users: CSUser[];
	unreads: CSUnreads;
	repos: CSRepository[];
	services: {
		vsls?: boolean;
	};
	version: string;
	preferences: CSMePreferences;
	configs: {
		[k: string]: any;
	};
	panelStack?: string[];
}

interface CSWebviewRequest {
	id: string;
	action: string;
	params: any;
}

// TODO: Make this work
class BufferChangeTracker {
	private _listeners: Map<string, Function[]>;

	constructor() {
		this._listeners = new Map();
	}

	observe(codeBlock: CSCodeBlock, listener: (hasDiff: boolean) => void) {
		const listenersForFile = this._listeners.get(codeBlock.file) || [];
		listenersForFile.push(listener);

		listener(this._hasDiff(codeBlock));
	}

	unsubscribe(codeBlock: CSCodeBlock): void {
		this._listeners.delete(codeBlock.file);
	}

	private _hasDiff(codeBlock: CSCodeBlock): boolean {
		// TODO: actually check if file has a diff against the content of codeblock
		return false;
	}
}

export class CodeStreamWebviewPanel implements Disposable {
	private _bufferChangeTracker = new BufferChangeTracker();

	private _onDidChangeStream = new EventEmitter<StreamThread>();
	get onDidChangeStream(): Event<StreamThread> {
		return this._onDidChangeStream.event;
	}

	private _onDidClose = new EventEmitter<void>();
	get onDidClose(): Event<void> {
		return this._onDidClose.event;
	}

	private _onDidChangeContextState = new EventEmitter<string[]>();
	get onDidChangeContextState(): Event<object> {
		return this._onDidChangeContextState.event;
	}

	private _bootstrapPromise: Promise<BootstrapState> | undefined;
	private _disposable: Disposable | undefined;
	private readonly _ipc: WebviewIpc;
	private _onReadyResolver: ((cancelled: boolean) => void) | undefined;
	private _panel: WebviewPanel | undefined;
	private _streamThread: StreamThread | undefined;
	private _uiContext: object | undefined;

	constructor(public readonly session: CodeStreamSession) {
		this._ipc = new WebviewIpc(this);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this._panel = undefined;
	}

	private onPanelDisposed() {
		if (this._onReadyResolver !== undefined) {
			this._onReadyResolver(true);
		}

		this._onDidClose.fire();
	}

	private _panelState: { active: boolean; visible: boolean } = {
		active: true,
		visible: true
	};

	private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
		const previous = this._panelState;
		this._panelState = { active: e.webviewPanel.active, visible: e.webviewPanel.visible };
		if (this._panelState.visible === previous.visible) return;

		if (!this._panelState.visible) {
			this._ipc.sendDidBlur();

			return;
		}

		this._ipc.resume();

		if (window.state.focused) {
			this._ipc.sendDidFocus();
		}
	}

	private async onPanelWebViewMessageReceived(e: WebviewIpcMessage) {
		// TODO: Given all the async work in here -- we need to extract this into a separate method with blocks to make sure events don't get interleaved
		try {
			Logger.log(`WebviewPanel: Received message ${toLoggableIpcMessage(e)} from the webview`);

			const { type } = e;
			switch (type) {
				case WebviewIpcMessageType.onViewReady: {
					// view is rendered and ready to receive messages
					if (this._onReadyResolver !== undefined) {
						this._onReadyResolver(false);
					}
					break;
				}
				case WebviewIpcMessageType.onRequest: {
					const body = e.body as CSWebviewRequest;
					// TODO: Add exception handling for failed requests
					switch (body.action) {
						case "bootstrap": {
							Logger.log(
								`WebviewPanel: Bootstrapping webview...`,
								`SignedIn=${this.session.signedIn}`
							);

							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };
							try {
								const state = await (this._bootstrapPromise || this.getBootstrapState());
								this._bootstrapPromise = undefined;

								if (this._streamThread !== undefined) {
									state.currentStreamId = this._streamThread.stream.id;
									state.currentThreadId = this._streamThread.id;
								}

								responseBody.payload = state;
							} catch (ex) {
								debugger;
								Logger.error(ex);

								responseBody.error = ex.message;
							}

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}
						case "authenticate": {
							const { email, password } = body.params;

							let status: LoginResult;
							try {
								status = await this.session.login(email, password);
							} catch (ex) {
								status = LoginResult.Unknown;
							}

							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };
							if (status === LoginResult.Success) {
								try {
									responseBody.payload = await this.getBootstrapState();
								} catch (ex) {
									debugger;
									Logger.error(ex);

									responseBody.error = ex.message;
								}
							} else {
								responseBody.error = status;
							}

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}

						case "go-to-signup": {
							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };
							try {
								await commands.executeCommand(
									"vscode.open",
									Uri.parse(
										`${
											Container.config.webAppUrl
										}/signup?force_auth=true&signup_token=${this.session.getSignupToken()}`
									)
								);
								responseBody.payload = true;
							} catch (ex) {
								responseBody.error = ex.message;
							}

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}
						case "go-to-slack-signin": {
							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };

							try {
								await commands.executeCommand(
									"vscode.open",
									Uri.parse(
										`${
											Container.config.webAppUrl
										}/service-auth/slack?state=${this.session.getSignupToken()}`
									)
								);
								responseBody.payload = true;
							} catch (ex) {
								responseBody.error = ex.message;
							}

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}
						case "validate-signup": {
							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };
							const status = await this.session.loginViaSignupToken(body.params);

							if (status === LoginResult.Success) {
								try {
									responseBody.payload = await this.getBootstrapState();
								} catch (ex) {
									debugger;
									Logger.error(ex);

									responseBody.error = ex.message;
								}
							} else responseBody.error = status;

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}
						case "show-markers": {
							const value = body.params;
							// set the config
							await configuration.update(
								configuration.name("showMarkers").value,
								value,
								ConfigurationTarget.Global
							);
							break;
						}
						case "mute-all": {
							const value = body.params;
							// set the config
							await configuration.update(
								configuration.name("muteAll").value,
								value,
								ConfigurationTarget.Global
							);
							break;
						}
						case "open-comment-on-select": {
							const value = body.params;
							// set the config
							await configuration.update(
								configuration.name("openCommentOnSelect").value,
								value,
								ConfigurationTarget.Global
							);
							break;
						}
						case "show-code": {
							const { marker, enteringThread, source } = e.body.params;
							const status = await Container.commands.openPostWorkingFile(marker, {
								preserveFocus: enteringThread,
								source: source
							});
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: e.body.id, payload: status }
							});

							break;
						}
						case "highlight-code": {
							const { marker, onOff } = e.body.params;
							const status = await Container.commands.highlightCode(marker, {
								onOff
							});
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: e.body.id, payload: status }
							});

							break;
						}
						case "reveal-line": {
							const { line } = e.body.params;
							commands.executeCommand("revealLine", { lineNumber: line, at: "top" });

							break;
						}
						case "start-comment-on-line": {
							const { line, uri } = e.body.params;
							const status = await Container.commands.startCommentOnLine({ line, uri });
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: e.body.id, payload: status }
							});

							break;
						}
						default: {
							const responseBody: { id: string; [key: string]: any } = { id: body.id };
							try {
								responseBody.payload = await Container.agent.sendRequest(
									new RequestType<any, any, any, any>(body.action),
									body.params
								);
							} catch (error) {
								responseBody.error = error.message;
							} finally {
								this.postMessage({
									type: WebviewIpcMessageType.response,
									body: responseBody
								});
							}
							break;
						}
					}
					break;
				}
				case WebviewIpcMessageType.onActiveThreadChanged: {
					const { threadId, streamId } = e.body;
					if (this._streamThread !== undefined && this._streamThread.stream.id === streamId) {
						this._streamThread.id = threadId;
						this._onDidChangeStream.fire(this._streamThread);
					}

					break;
				}
				case WebviewIpcMessageType.onActiveThreadClosed: {
					if (this._streamThread !== undefined) {
						this._streamThread.id = undefined;
						this._onDidChangeStream.fire(this._streamThread);
					}

					break;
				}
				case WebviewIpcMessageType.onContextStateChanged: {
					this._onDidChangeContextState.fire(e.body);
					break;
				}
				case WebviewIpcMessageType.onActiveStreamChanged: {
					const streamId = e.body;

					if (!streamId) {
						if (this._streamThread !== undefined) {
							this._streamThread = undefined;
							this._onDidChangeStream.fire(this._streamThread);
						}

						return;
					}

					const stream = await this.session.getStream(streamId);
					if (stream !== undefined) {
						this._streamThread = { id: undefined, stream: stream };
						this._onDidChangeStream.fire(this._streamThread);
					}

					break;
				}
				case WebviewIpcMessageType.onCodemarkApplyPatch: {
					const { marker } = e.body;
					Container.commands.applyMarker({ marker: marker });

					break;
				}
				case WebviewIpcMessageType.onCodemarkShowDiff: {
					const { marker } = e.body;
					Container.commands.showMarkerDiff({ marker: marker });

					break;
				}
				case WebviewIpcMessageType.onServiceRequest: {
					this._ipc.onServiceRequest(e.body);

					break;
				}
				case WebviewIpcMessageType.onFileChangedSubscribe: {
					const codeBlock = e.body as CSCodeBlock;

					this._bufferChangeTracker.observe(codeBlock, hasDiff => {
						this.postMessage({
							type: WebviewIpcMessageType.didFileChange,
							body: {
								file: codeBlock.file,
								hasDiff
							}
						});
					});

					break;
				}
				case WebviewIpcMessageType.onFileChangedUnsubscribe: {
					const codeblock = e.body as CSCodeBlock;
					this._bufferChangeTracker.unsubscribe(codeblock);

					break;
				}
				case WebviewIpcMessageType.onReloadRequest: {
					this.reload();
					break;
				}
			}
		} catch (ex) {
			debugger;
			Container.agent.reportMessage(ReportingMessageType.Error, ex.message);
			Logger.error(ex);
		}
	}

	private onSessionDataChanged(
		e:
			| CodemarksChangedEvent
			| PostsChangedEvent
			| PreferencesChangedEvent
			| RepositoriesChangedEvent
			| StreamsChangedEvent
			| TeamsChangedEvent
			| UnreadsChangedEvent
			| UsersChangedEvent
	) {
		switch (e.type) {
			case SessionChangedEventType.Codemarks:
			case SessionChangedEventType.Posts:
			case SessionChangedEventType.Preferences:
			case SessionChangedEventType.Repositories:
			case SessionChangedEventType.Streams:
			case SessionChangedEventType.Teams:
			case SessionChangedEventType.Unreads:
			case SessionChangedEventType.Users:
				const msg = e.toIpcMessage();
				Logger.log(
					`WebviewPanel: Attempting to send ${toLoggableIpcMessage(msg)} to the webview...`
				);
				this.postMessage(msg);
				break;
		}
	}

	private onWindowStateChanged(e: WindowState) {
		if (this._panelState.visible) {
			if (e.focused) {
				this._ipc.sendDidFocus();
			} else {
				this._ipc.sendDidBlur();
			}
		}
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (
			configuration.changed(e, configuration.name("avatars").value) ||
			configuration.changed(e, configuration.name("muteAll").value) ||
			configuration.changed(e, configuration.name("showMarkers").value) ||
			configuration.changed(e, configuration.name("openCommentOnSelect").value) ||
			configuration.changed(e, configuration.name("traceLevel").value)
		) {
			this.postMessage({
				type: WebviewIpcMessageType.didChangeConfiguration,
				body: {
					debug: Container.config.traceLevel === "debug",
					muteAll: Container.config.muteAll,
					serverUrl: this.session.serverUrl,
					showHeadshots: Container.config.avatars,
					showMarkers: Container.config.showMarkers,
					openCommentOnSelect: Container.config.openCommentOnSelect
				}
			});
		}
	}

	get streamThread() {
		return this._streamThread;
	}

	get viewColumn(): ViewColumn | undefined {
		return this._panel === undefined ? undefined : this._panel.viewColumn;
	}

	get visible() {
		return this._panel === undefined ? false : this._panel.visible;
	}

	@log()
	hide() {
		if (this._panel === undefined) return;
		this._panel.dispose();
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
		isHighlight?: boolean
	) {
		let file;
		if (source === undefined) {
			const folder = workspace.getWorkspaceFolder(uri);
			if (folder !== undefined) {
				file = path.relative(folder.uri.fsPath, uri.fsPath);
			}
		} else {
			file = source.file;
		}

		void (await this.postMessage({
			type: WebviewIpcMessageType.didSelectCode,
			body: {
				code: code,
				file: file,
				fileUri: uri.toString(),
				location: [range.start.line, range.start.character, range.end.line, range.end.character],
				source: source,
				gitError,
				isHighlight
			}
		} as DidSelectCodeNotification));
		return this._streamThread;
	}

	@log()
	async reload() {
		if (this._panel === undefined) return this.createWebview(this._streamThread);

		// Reset the html to get the webview to reload
		this._panel.webview.html = "";
		this._panel.webview.html = await this.getHtml();
		this._panel.reveal(this._panel.viewColumn, false);

		const cancelled = await this.waitUntilReady();
		if (cancelled) return undefined;

		return this._streamThread;
	}

	@log()
	async setConnectionStatus(status: ConnectionStatus, reset?: boolean) {
		if (this._panel === undefined) return;

		switch (status) {
			case ConnectionStatus.Disconnected:
				// TODO: Handle this
				break;

			case ConnectionStatus.Reconnecting:
				void (await this._ipc.sendDidDisconnect());
				break;
			case ConnectionStatus.Reconnected:
				if (reset) {
					void (await this.reload());

					return;
				}

				void (await this._ipc.sendDidConnect());
				break;
		}
	}

	@log({
		args: false
	})
	async show(streamThread?: StreamThread, uiContext?: object) {
		if (uiContext) this._uiContext = uiContext;
		if (this._panel === undefined) return this.createWebview(streamThread);

		if (
			streamThread === undefined ||
			(this._streamThread &&
				this._streamThread.id === streamThread.id &&
				this._streamThread.stream.id === streamThread.stream.id)
		) {
			this._panel.reveal(this._panel.viewColumn, false);

			return this._streamThread;
		}

		this._ipc.sendDidChangeStreamThread(streamThread);

		this._streamThread = streamThread;
		this._onDidChangeStream.fire(this._streamThread);

		return this._streamThread;
	}

	@log()
	signedOut() {
		if (this._panel !== undefined) {
			this._streamThread = undefined;
			this.postMessage({ type: WebviewIpcMessageType.didSignOut, body: null });
		}
	}

	private async createWebview(streamThread?: StreamThread): Promise<StreamThread | undefined> {
		// Kick off the bootstrap compute to be ready for later
		this._bootstrapPromise = this.getBootstrapState();

		this._panel = window.createWebviewPanel(
			"CodeStream.stream",
			"CodeStream",
			{ viewColumn: ViewColumn.Beside, preserveFocus: false },
			{
				retainContextWhenHidden: true,
				enableFindWidget: true,
				enableCommandUris: true,
				enableScripts: true
			}
		);
		this._panel.iconPath = Uri.file(
			Container.context.asAbsolutePath("assets/images/codestream.png")
		);

		this._ipc.connect(this._panel);

		this._disposable = Disposable.from(
			this.session.onDidChangeCodemarks(this.onSessionDataChanged, this),
			this.session.onDidChangePosts(this.onSessionDataChanged, this),
			this.session.onDidChangeRepositories(this.onSessionDataChanged, this),
			this.session.onDidChangeStreams(this.onSessionDataChanged, this),
			this.session.onDidChangeTeams(this.onSessionDataChanged, this),
			this.session.onDidChangeUnreads(this.onSessionDataChanged, this),
			this.session.onDidChangeUsers(this.onSessionDataChanged, this),
			this.session.onDidChangePreferences(this.onSessionDataChanged, this),
			this._panel,
			this._panel.onDidDispose(this.onPanelDisposed, this),
			this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
			this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this),
			window.onDidChangeActiveTextEditor(Functions.debounce(this.onActiveEditorChanged, 100), this),
			window.onDidChangeTextEditorSelection(
				Functions.debounce(this.onEditorSelectionChanged, 250, { maxWait: 250 }),
				this
			),
			window.onDidChangeWindowState(this.onWindowStateChanged, this),
			configuration.onDidChange(this.onConfigurationChanged, this),
			window.onDidChangeTextEditorVisibleRanges(this.onDidChangeTextEditorVisibleRanges, this)
		);

		this._panel.webview.html = await this.getHtml();
		this._panel.reveal(this._panel.viewColumn, false);

		this._streamThread = streamThread;

		const cancelled = await this.waitUntilReady();
		if (cancelled) return undefined;

		this._onDidChangeStream.fire(this._streamThread);

		return this._streamThread;
	}

	private async onActiveEditorChanged(editor: TextEditor | undefined) {
		this._ipc.sendDidChangeActiveEditor(editor);
	}

	private async onEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
		if (e.selections.length === 0) return;

		const selection = e.selections[0];
		if (selection.start.isEqual(selection.end)) return;

		const uri = e.textEditor.document.uri;

		const response = await Container.agent.posts.prepareCode(e.textEditor.document, selection);
		await this.postCode(response.code, uri, selection, response.source, response.gitError, true);
	}

	private async onDidChangeTextEditorVisibleRanges(e: TextEditorVisibleRangesChangeEvent) {
		const uri = e.textEditor.document.uri;

		void (await this.postMessage({
			type: WebviewIpcMessageType.didScroll,
			body: {
				uri,
				firstLine: e.visibleRanges[0].start.line,
				lastLine: e.visibleRanges[0].end.line
			}
		} as DidScrollNotification));
	}

	private async getBootstrapState() {
		const state: BootstrapState = Object.create(null);

		if (!this.session.signedIn) {
			state.env = this.session.environment;
			state.configs = { email: Container.config.email };
			state.services = {};
			state.version = Container.versionFormatted;

			return state;
		}

		const promise = Promise.all([
			Container.agent.repos.fetch(),
			Container.agent.streams.fetch(),
			Container.agent.teams.fetch(),
			Container.agent.users.unreads(),
			Container.agent.users.fetch(),
			Container.agent.users.preferences()
		]);

		state.capabilities = this.session.capabilities;
		state.configs = {
			debug: Container.config.traceLevel === "debug",
			email: Container.config.email,
			muteAll: Container.config.muteAll,
			serverUrl: this.session.serverUrl,
			showHeadshots: Container.config.avatars,
			showMarkers: Container.config.showMarkers,
			openCommentOnSelect: Container.config.openCommentOnSelect
		};
		state.currentTeamId = this.session.team.id;
		state.currentUserId = this.session.userId;
		state.env = this.session.environment;
		state.services = {
			vsls: Container.vsls.installed
		};
		state.version = Container.versionFormatted;

		if (this._uiContext) state.context = this._uiContext;

		const [
			reposResponse,
			streamsResponse,
			teamsResponse,
			unreadsResponse,
			usersResponse,
			preferencesResponse
		] = await promise;

		state.repos = reposResponse.repos;
		state.streams = streamsResponse.streams;
		state.teams = teamsResponse.teams;
		state.unreads = unreadsResponse.unreads;
		state.users = usersResponse.users;
		state.preferences = preferencesResponse.preferences;

		if (this._streamThread !== undefined) {
			state.currentStreamId = this._streamThread.stream.id;
			state.currentThreadId = this._streamThread.id;
		}

		return state;
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

	private postMessage(request: WebviewIpcMessage) {
		return this._ipc.postMessage(request);
	}

	private waitUntilReady() {
		// Wait until the webview is ready
		return new Promise((resolve, reject) => {
			let timer: NodeJS.Timer;
			if (Logger.level !== TraceLevel.Debug && !Logger.isDebugging) {
				timer = setTimeout(() => {
					Logger.warn("Webview: FAILED waiting for webview ready event; closing webview...");
					this.dispose();
					resolve(true);
				}, 30000);
			}

			this._onReadyResolver = (cancelled: boolean) => {
				if (timer !== undefined) {
					clearTimeout(timer);
				}

				if (cancelled) {
					Logger.log("Webview: CANCELLED waiting for webview ready event");
					this._ipc.clear();
				} else {
					this._ipc.resume();
				}

				this._onReadyResolver = undefined;
				resolve(cancelled);
			};
		});
	}
}
