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
} from "../api/api";
import {
	CodeStreamEnvironment,
	CodeStreamSession,
	Post,
	PostsReceivedEvent,
	SessionChangedEvent,
	SessionChangedType,
	StreamThread
} from "../api/session";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { WebviewIpc, WebviewIpcMessage } from "./webviewIpc";

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
			this._ipc.onBlur();

			return;
		}

		this._ipc.resume();

		if (window.state.focused) {
			this._ipc.onFocus();
		}
	}

	private async getBootstrapState() {
		const state: BootstrapState = Object.create(null);

		const promise = Promise.all([
			this.session.repos.entities(),
			this.session.channelsAndDMs.entities(),
			this.session.teams.entities(),
			this.session.users.entities()
		]);

		state.configs = {
			serverUrl: this.session.serverUrl,
			reduceMotion: Container.config.reduceMotion,
			showHeadshots: Container.config.avatars
		};
		state.currentTeamId = this.session.team.id;
		state.currentUserId = this.session.userId;
		state.env = this.session.environment;
		state.services = {
			vsls: Container.liveShare.isInstalled
		};
		state.unreads = this.session.unreads.getValues();
		state.version = Container.version;

		const currentUser = this.session.user.entity;
		const [repos, streams, teams, users] = await promise;

		state.repos = repos;
		state.streams = streams;
		state.teams = teams;
		state.users = users.map(user => (user.id === currentUser.id ? currentUser : user));

		return state;
	}

	private async onPanelWebViewMessageReceived(e: WebviewIpcMessage) {
		// TODO: Given all the async work in here -- we need to extract this into a separate method with blocks to make sure events don't get interleaved
		try {
			const { type } = e;

			switch (type.replace("codestream:", "")) {
				case "view-ready": {
					// view is rendered and ready to receive messages
					if (this._onReadyResolver !== undefined) {
						this._onReadyResolver();
					}
					break;
				}
				case "request": {
					const body = e.body as CSWebviewRequest;
					// TODO: Add sequence ids to ensure correct matching
					// TODO: Add exception handling for failed requests
					switch (body.action) {
						case "bootstrap":
							let state: BootstrapState = Object.create(null);
							if (this.session.signedIn) {
								state = await (this._bootstrapPromise || this.getBootstrapState());
								this._bootstrapPromise = undefined;
								if (this._streamThread !== undefined) {
									state.currentStreamId = this._streamThread.stream.id;
									state.currentThreadId = this._streamThread.id;
								}
							} else {
								state.env = this.session.environment;
								state.configs = { email: Container.config.email };
								state.services = {};
								state.version = Container.version;
							}

							this.postMessage({
								type: "codestream:response",
								body: {
									id: body.id,
									payload: state
								}
							});
							break;
						case "authenticate": {
							const { email, password } = body.params;

							const status = await this.session.login(email, password);

							const responseBody: { id: string; [k: string]: any } = { id: body.id };

							if (status === LoginResult.Success) {
								responseBody.payload = await this.getBootstrapState();
							} else responseBody.error = status;

							this.postMessage({
								type: "codestream:response",
								body: responseBody
							});
							break;
						}
						case "go-to-signup": {
							const responseBody: { id: string; [k: string]: any } = { id: body.id };
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
							} catch (error) {
								responseBody.error = error.message;
							}

							this.postMessage({
								type: "codestream:response",
								body: responseBody
							});
							break;
						}
						case "validate-signup": {
							const responseBody: { id: string; [k: string]: any } = { id: body.id };
							const status = await this.session.loginViaSignupToken();

							if (status === LoginResult.Success) {
								responseBody.payload = await this.getBootstrapState();
							} else responseBody.error = status;

							this.postMessage({
								type: "codestream:response",
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
								streamId,
								teamId
							} = body.params;

							const responseBody: { [key: string]: any } = {
								id: body.id
							};
							let post;
							try {
								if (codeBlocks === undefined || codeBlocks.length === 0) {
									post = await this.session.api.createPost(
										text,
										mentions,
										parentPostId,
										streamId,
										teamId
									);
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
									post = await Container.agent.postCode(
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
							} catch (error) {
								responseBody.error = error;
							}

							if (post) {
								responseBody.payload = post;
							}

							this.postMessage({
								type: "codestream:response",
								body: responseBody
							});
							break;
						}
						case "fetch-posts": {
							const { streamId, teamId } = body.params;
							this.postMessage({
								type: "codestream:response",
								body: {
									id: body.id,
									payload: await this.session.api.getPosts(streamId, teamId)
								}
							});
							break;
						}
						case "delete-post": {
							const post = await this.session.api.getPost(body.params);
							const updates = await this.session.api.deletePost(body.params);
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: { ...post, ...updates } }
							});
							break;
						}
						case "edit-post": {
							const { id, text, mentions } = body.params;
							const post = await this.session.api.getPost(id);
							const updates = await this.session.api.editPost(id, text, mentions);
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: { ...post, ...updates } }
							});
							break;
						}
						case "mark-stream-read": {
							const stream = await this.session.getStream(body.params);
							if (stream) {
								const response = await stream.markRead();
								this.postMessage({
									type: "codestream:response",
									body: { id: body.id, payload: response }
								});
							} else {
								debugger;
								// TODO
							}
							break;
						}
						case "mark-post-unread": {
							const post = await this.session.api.getPost(body.params);
							const updates = await this.session.api.markPostUnread(body.params);
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: { ...post, ...updates } }
							});
							break;
						}
						case "create-stream": {
							const { type, teamId, name, privacy, memberIds } = body.params;
							let stream;
							if (type === "channel") {
								stream = await this.session.api.createChannelStream(
									name,
									memberIds,
									privacy,
									teamId
								);
							} else if (type === "direct") {
								stream = await this.session.api.createDirectStream(memberIds);
							}
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: stream }
							});
							break;
						}
						case "save-user-preference": {
							const response = await this.session.api.savePreferences(body.params);
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: response }
							});
							break;
						}
						case "invite": {
							const { email, teamId, fullName } = body.params;
							this.postMessage({
								type: "codestream:response",
								body: {
									id: body.id,
									payload: await this.session.api.invite(email, teamId, fullName)
								}
							});
							break;
						}
						case "join-stream": {
							const { streamId, teamId } = body.params;
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: await this.session.api.joinStream(streamId, teamId) }
							});
							break;
						}
						case "leave-stream": {
							const { streamId, teamId, update } = body.params;
							try {
								await this.session.api.updateStream(streamId, update);
							} catch (e) {
								/* */
							}
							this.session.leaveChannel(streamId, teamId);
							this.postMessage({
								type: "codestream:response",
								body: { id: body.id, payload: true }
							});
							break;
						}
						case "update-stream": {
							const { streamId, update } = body.params;
							const responseBody: { [key: string]: any } = { id: body.id };
							try {
								responseBody.payload = await this.session.api.updateStream(streamId, update);
							} catch (error) {
								responseBody.error = error;
							}
							this.postMessage({
								type: "codestream:response",
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
								type: "codestream:response",
								body: { id: e.body.id, payload: status }
							});
							break;
						}
					}
					break;
				}
				case "interaction:thread-selected": {
					const { threadId, streamId } = e.body;
					if (this._streamThread !== undefined && this._streamThread.stream.id === streamId) {
						this._streamThread.id = threadId;
						this._onDidChangeStream.fire(this._streamThread);
					}
					break;
				}
				case "interaction:thread-closed": {
					if (this._streamThread !== undefined) {
						this._streamThread.id = undefined;
						this._onDidChangeStream.fire(this._streamThread);
					}
					break;
				}
				case "interaction:changed-active-stream": {
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
				case "subscription:file-changed": {
					const codeBlock = e.body as CSCodeBlock;

					this._bufferChangeTracker.observe(codeBlock, hasDiff => {
						this.postMessage({
							type: "codestream:publish:file-changed",
							body: {
								file: codeBlock.file,
								hasDiff
							}
						});
					});
					break;
				}
				case "unsubscribe:file-changed": {
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

	private onPostsReceived(e: PostsReceivedEvent) {
		Logger.log(`WebviewPanel.onPostsReceived: Attempting to send new posts to the webview...`);
		this.postMessage({
			type: "codestream:data",
			body: {
				type: "posts",
				payload: e.entities()
			}
		});
	}

	private onSessionChanged(e: SessionChangedEvent) {
		switch (e.type) {
			case SessionChangedType.Streams:
			case SessionChangedType.Repositories:
			case SessionChangedType.Users:
			case SessionChangedType.Teams:
				Logger.log(
					`WebviewPanel.onSessionChanged: Attempting to send new ${e.type} to the webview...`
				);
				this.postMessage({
					type: "codestream:data",
					body: {
						type: e.type,
						payload: e.entities()
					}
				});
				break;
			case SessionChangedType.Unreads: {
				Logger.log(
					`WebviewPanel.onSessionChanged: Attempting to send update unreads to the webview...`
				);
				this.postMessage({
					type: "codestream:data:unreads",
					body: e.unreads
				});
				break;
			}
			case SessionChangedType.StreamsMembership: {
				// TODO: Does this need to be sent to the view?
				break;
			}
		}
	}

	private onWindowStateChanged(e: WindowState) {
		if (this._panelState.visible) {
			if (e.focused) {
				this._ipc.onFocus();
			} else {
				this._ipc.onBlur();
			}
		}
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (
			configuration.changed(e, configuration.name("avatars").value) ||
			configuration.changed(e, configuration.name("reduceMotion").value)
		) {
			this.postMessage({
				type: "codestream:configs",
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

	post(text: string) {
		return this.postMessage({
			type: "interaction",
			body: {
				type: "SELECTED_CODE",
				payload: {
					text: text
				}
			}
		});
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
			type: "codestream:interaction:code-highlighted",
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

		this._ipc.onChangeStreamThread(streamThread);

		this._streamThread = streamThread;
		this._onDidChangeStream.fire(this._streamThread);

		return this._streamThread;
	}

	signedOut() {
		if (this._panel !== undefined) {
			this._streamThread = undefined;
			this.postMessage({ type: "codestream:interaction:signed-out", body: null });
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
			this.session.onDidReceivePosts(this.onPostsReceived, this),
			this.session.onDidChange(this.onSessionChanged, this),
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
			}, 15000);

			this._onReadyResolver = () => {
				clearTimeout(timer);
				resolve();
			};
		});
	}
}
