"use strict";
import * as fs from "fs";
import * as path from "path";
import {
	commands,
	ConfigurationChangeEvent,
	Disposable,
	Event,
	EventEmitter,
	Range,
	Uri,
	ViewColumn,
	WebviewPanel,
	WebviewPanelOnDidChangeViewStateEvent,
	window,
	WindowState,
	workspace
} from "vscode";
import {
	CSCodeBlock,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	LoginResult
} from "../agent/agentConnection";
import {
	CodeStreamEnvironment,
	CodeStreamSession,
	Post,
	PostsChangedEvent,
	RepositoriesChangedEvent,
	SessionChangedEventType,
	StreamsChangedEvent,
	StreamsMembershipChangedEvent,
	StreamThread,
	TeamsChangedEvent,
	UnreadsChangedEvent,
	UsersChangedEvent
} from "../api/session";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	toLoggableIpcMessage,
	WebviewIpc,
	WebviewIpcMessage,
	WebviewIpcMessageResponseBody,
	WebviewIpcMessageType
} from "./webviewIpc";

interface BootstrapState {
	currentTeamId: string;
	currentUserId: string;
	currentStreamId: string;
	currentStreamLabel?: string;
	currentStreamServiceType?: "liveshare";
	currentThreadId?: string;
	env: CodeStreamEnvironment;
	posts: CSPost[];
	streams: CSStream[];
	teams: CSTeam[];
	users: CSUser[];
	unreads: { unread: { [streamId: string]: number }; mentions: { [streamId: string]: number } };
	repos: CSRepository[];
	services: {
		vsls?: boolean;
	};
	version: string;
	configs: {
		[k: string]: any;
	};
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

export class StreamWebviewPanel implements Disposable {
	private _bufferChangeTracker = new BufferChangeTracker();

	private _onDidChangeStream = new EventEmitter<StreamThread>();
	get onDidChangeStream(): Event<StreamThread> {
		return this._onDidChangeStream.event;
	}

	private _onDidClose = new EventEmitter<void>();
	get onDidClose(): Event<void> {
		return this._onDidClose.event;
	}

	private _bootstrapPromise: Promise<BootstrapState> | undefined;
	private _disposable: Disposable | undefined;
	private readonly _ipc: WebviewIpc;
	private _onReadyResolver: ((value?: {} | PromiseLike<{}> | undefined) => void) | undefined;
	private _panel: WebviewPanel | undefined;
	private _streamThread: StreamThread | undefined;

	constructor(public readonly session: CodeStreamSession) {
		this._ipc = new WebviewIpc(this);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
		this._panel = undefined;
	}

	private onPanelDisposed() {
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
						this._onReadyResolver();
					}
					break;
				}
				case WebviewIpcMessageType.onRequest: {
					const body = e.body as CSWebviewRequest;
					// TODO: Add exception handling for failed requests
					switch (body.action) {
						case "bootstrap":
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
							const redirectUri = `${Container.config.webAppUrl}/oauth/callback`;
							try {
								await commands.executeCommand(
									"vscode.open",
									Uri.parse(
										`https://slack.com/oauth/authorize?client_id=251469054195.443134779744&scope=client%20identify&redirect_uri=${redirectUri}&state=${this.session.getSignupToken()}`
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
						case "create-post": {
							const {
								text,
								extra: { fileUri } = { fileUri: undefined },
								codeBlocks,
								mentions,
								parentPostId,
								streamId
							} = body.params;

							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };

							let post;
							try {
								if (codeBlocks === undefined || codeBlocks.length === 0) {
									post = await Container.agent.posts.create(streamId, text, mentions, parentPostId);
								} else {
									const block = codeBlocks[0] as {
										code: string;
										location?: [number, number, number, number];
										file?: string;
										source?: {
											file: string;
											repoPath: string;
											revision: string;
											authors: { id: string; username: string }[];
											remotes: { name: string; url: string }[];
										};
									};

									const uri = block.source
										? Uri.file(path.join(block.source.repoPath, block.source.file))
										: Uri.parse(fileUri);
									post = await Container.agent.posts.createWithCode(
										uri,
										text,
										mentions,
										block.code,
										block.location,
										block.source,
										parentPostId,
										streamId
									);
								}
							} catch (ex) {
								responseBody.error = ex;
							}

							if (post) {
								responseBody.payload = post;
							}

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});
							break;
						}
						case "fetch-posts": {
							const { streamId, limit, beforeSeqNum } = body.params;

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: {
									id: body.id,
									payload: (await Container.agent.posts.fetch(streamId, {
										limit: limit,
										before: beforeSeqNum
									})).posts
								}
							});
							break;
						}
						case "delete-post": {
							const { streamId, id } = body.params;

							const post = await Container.agent.posts.delete(streamId, id);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: post }
							});

							break;
						}
						case "react-to-post": {
							const { streamId, id, emoji, value } = body.params;

							const post = await Container.agent.posts.react(streamId, id, { [emoji]: value });
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: post }
							});

							break;
						}
						case "edit-post": {
							const { streamId, id, text, mentions } = body.params;

							const post = await Container.agent.posts.edit(streamId, id, text, mentions);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: post }
							});

							break;
						}
						case "mark-stream-read": {
							const { streamId, id } = body.params;

							const response = await Container.agent.streams.markRead(streamId, id);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: response }
							});

							break;
						}
						case "mark-post-unread": {
							const { streamId, id } = body.params;

							const post = await Container.agent.posts.markUnread(streamId, id);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: post }
							});

							break;
						}
						case "create-stream": {
							const { type, name, purpose, privacy, memberIds } = body.params;

							let stream;
							if (type === "channel") {
								stream = await Container.agent.streams.createChannel(
									name,
									memberIds,
									privacy,
									purpose
								);
							} else if (type === "direct") {
								stream = await Container.agent.streams.createDirect(memberIds);
							}
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: stream }
							});

							break;
						}
						case "save-user-preference": {
							const response = await Container.agent.users.updatePreferences(body.params);

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: response }
							});

							break;
						}
						case "invite": {
							const { email, fullName } = body.params;

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: {
									id: body.id,
									payload: await Container.agent.users.invite(email, fullName)
								}
							});

							break;
						}
						case "join-stream": {
							const { streamId } = body.params;

							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: await Container.agent.streams.join(streamId) }
							});

							break;
						}
						case "leave-stream": {
							const { streamId } = body.params;

							try {
								await Container.agent.streams.leave(streamId);
							} catch (e) {
								/* */
							}

							this.session.notifyDidLeaveChannel(streamId);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: body.id, payload: true }
							});

							break;
						}
						case "update-stream": {
							const { streamId, update: changes } = body.params;

							const responseBody: WebviewIpcMessageResponseBody = { id: body.id };
							try {
								responseBody.payload = await Container.agent.streams.update(streamId, changes);
							} catch (ex) {
								responseBody.error = ex;
							}
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: responseBody
							});

							break;
						}
						case "show-code": {
							const { post, enteringThread } = e.body.params;
							if (post.codeBlocks == null || post.codeBlocks.length === 0) return;

							const stream = await this.session.getStream(post.streamId);
							const status = await Container.commands.openPostWorkingFile(
								new Post(this.session, post, stream),
								{ preserveFocus: enteringThread }
							);
							this.postMessage({
								type: WebviewIpcMessageType.response,
								body: { id: e.body.id, payload: status }
							});

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
			}
		} catch (ex) {
			debugger;
			Logger.error(ex);
		}
	}

	private onSessionDataChanged(
		e:
			| PostsChangedEvent
			| RepositoriesChangedEvent
			| StreamsChangedEvent
			| StreamsMembershipChangedEvent
			| TeamsChangedEvent
			| UnreadsChangedEvent
			| UsersChangedEvent
	) {
		switch (e.type) {
			case SessionChangedEventType.Posts:
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
			configuration.changed(e, configuration.name("reduceMotion").value)
		) {
			this.postMessage({
				type: WebviewIpcMessageType.didChangeConfiguration,
				body: {
					serverUrl: this.session.serverUrl,
					showHeadshots: Container.config.avatars,
					reduceMotion: Container.config.reduceMotion
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
		gitError?: string
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
			type: WebviewIpcMessageType.didPostCode,
			body: {
				code: code,
				file: file,
				fileUri: uri.toString(),
				location: [range.start.line, range.start.character, range.end.line, range.end.character],
				source: source,
				gitError
			}
		}));
		return this._streamThread;
	}

	async reload() {
		if (this._panel === undefined) return this.createWebview(this._streamThread);

		// Reset the html to get the webview to reload
		this._panel.webview.html = "";
		this._panel.webview.html = await this.getHtml();
		this._panel.reveal(this._panel.viewColumn, false);

		await this.waitUntilReady();

		return this._streamThread;
	}

	show(streamThread?: StreamThread) {
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
			this.session.onDidChangePosts(this.onSessionDataChanged, this),
			this.session.onDidChangeRepositories(this.onSessionDataChanged, this),
			this.session.onDidChangeStreams(this.onSessionDataChanged, this),
			this.session.onDidChangeTeams(this.onSessionDataChanged, this),
			this.session.onDidChangeUnreads(this.onSessionDataChanged, this),
			this.session.onDidChangeUsers(this.onSessionDataChanged, this),
			this._panel,
			this._panel.onDidDispose(this.onPanelDisposed, this),
			this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
			this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this),
			window.onDidChangeWindowState(this.onWindowStateChanged, this),
			configuration.onDidChange(this.onConfigurationChanged, this)
		);

		this._panel.webview.html = await this.getHtml();
		this._panel.reveal(this._panel.viewColumn, false);

		this._streamThread = streamThread;

		await this.waitUntilReady();

		this._onDidChangeStream.fire(this._streamThread);

		return this._streamThread;
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
			this.session.repos.entities(),
			this.session.channelsAndDMs.entities(),
			this.session.teams.entities(),
			this.session.unreads.entity(),
			this.session.users.entities()
		]);

		state.configs = {
			serverUrl: this.session.serverUrl,
			reduceMotion: Container.config.reduceMotion,
			showHeadshots: Container.config.avatars,
			email: Container.config.email
		};
		state.currentTeamId = this.session.team.id;
		state.currentUserId = this.session.userId;
		state.env = this.session.environment;
		state.services = {
			vsls: Container.vsls.installed
		};
		state.version = Container.versionFormatted;

		const currentUser = this.session.user.entity;
		const [repos, streams, teams, unreads, users] = await promise;

		state.repos = repos;
		state.streams = streams;
		state.teams = teams;
		state.unreads = unreads;
		state.users = users.map(user => (user.id === currentUser.id ? currentUser : user));

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
			const timer = setTimeout(() => {
				Logger.warn("Webview: FAILED waiting for webview ready event; closing webview...");
				this.dispose();
				resolve();
			}, 30000);

			this._onReadyResolver = () => {
				clearTimeout(timer);
				resolve();
			};
		});
	}
}
