"use strict";
import * as fs from "fs";
import * as path from "path";
import {
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
import { CSCodeBlock, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "../api/api";
import {
	CodeStreamSession,
	Post,
	PostsReceivedEvent,
	SessionChangedEvent,
	SessionChangedType,
	SessionStatus,
	StreamThread
} from "../api/session";
import { Container } from "../container";
import { Logger } from "../logger";

const loadingHtml = `
<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
		<title>CodeStream</title>
		<style>
		html, body {
			height: 100%;
			overflow: hidden;
			padding: 0 !important;
		}

		.loading:before {
			background-position: center;
			background-repeat: no-repeat;
			background-size: contain;
			content: '';
			height: 100%;
			opacity: 0.05;
			position: absolute;
			width: 100%;
			z-index: -1;
		}

		.vscode-dark.loading:before {
			background-image: url('data:image/svg+xml;utf8,<svg width="50" height="40" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M20.4 19.87a4.57 4.57 0 1 0 9.13-.01 4.57 4.57 0 0 0-9.13.01z"/><path fill="#fff" d="M26.92 6.35c-.1.1-.17.24-.17.38v5.43a7.9 7.9 0 0 1 0 15.36v5.53a.53.53 0 0 0 .92.36l11.48-12.17c.71-.76.71-1.94 0-2.7L27.67 6.38a.53.53 0 0 0-.75-.02zm-4.64.02L10.8 18.55a1.96 1.96 0 0 0 0 2.69L22.28 33.4a.53.53 0 0 0 .91-.36v-5.53a7.9 7.9 0 0 1 0-15.36V6.73a.53.53 0 0 0-.53-.52.53.53 0 0 0-.38.16z"/></svg>');
		}

		.vscode-light.loading:before {
			background-image: url('data:image/svg+xml;utf8,<svg width="50" height="40" xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M20.4 19.87a4.57 4.57 0 1 0 9.13-.01 4.57 4.57 0 0 0-9.13.01z"/><path fill="#000" d="M26.92 6.35c-.1.1-.17.24-.17.38v5.43a7.9 7.9 0 0 1 0 15.36v5.53a.53.53 0 0 0 .92.36l11.48-12.17c.71-.76.71-1.94 0-2.7L27.67 6.38a.53.53 0 0 0-.75-.02zm-4.64.02L10.8 18.55a1.96 1.96 0 0 0 0 2.69L22.28 33.4a.53.53 0 0 0 .91-.36v-5.53a7.9 7.9 0 0 1 0-15.36V6.73a.53.53 0 0 0-.53-.52.53.53 0 0 0-.38.16z"/></svg>');
		}

		.loader-ring {
			height: 26vw;
			left: 50%;
			max-height: 31vh;
			max-width: 31vh;
			opacity: 0.5;
			position: absolute;
			top: 50%;
			transform: translate(-50%, -50%);
			width: 26vw;
		}

		.loader-ring__segment {
			animation: loader-ring-spin 1.5s infinite cubic-bezier(0.5, 0, 0.5, 1);
			border: 6px solid #009AEF;
			border-color: #009AEF transparent transparent transparent;
			border-radius: 50%;
			box-sizing: border-box;
			height: 100%;
			position: absolute;
			width: 100%;
		}

		.loader-ring__segment:nth-child(1) {
			animation-delay: 0.05s;
		}

		.loader-ring__segment:nth-child(2) {
			animation-direction: reverse;
		}

		.loader-ring__segment:nth-child(3) {
			animation-delay: 0.05s;
			animation-direction: reverse;
		}

		@keyframes loader-ring-spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		</style>
	</head>
	<body class="loading">
		<div class="loader-ring">
			<div class="loader-ring__segment"></div>
			<div class="loader-ring__segment"></div>
			<div class="loader-ring__segment"></div>
			<div class="loader-ring__segment"></div>
		</div>
	</body>
</html>
`;

interface BootstrapState {
	currentTeamId: string;
	currentUserId: string;
	currentStreamId: string;
	currentStreamLabel?: string;
	currentStreamServiceType?: "liveshare";
	selectedPostId?: string;
	posts: CSPost[];
	streams: CSStream[];
	teams: CSTeam[];
	users: CSUser[];
	repos: CSRepository[];
}

// TODO: Clean this up to be consistent with the structure
interface CSWebviewMessage {
	type: string;
	body: any;
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

export class StreamWebviewPanel extends Disposable {
	private _bufferChangeTracker = new BufferChangeTracker();

	private _onDidChangeStream = new EventEmitter<StreamThread>();
	get onDidChangeStream(): Event<StreamThread> {
		return this._onDidChangeStream.event;
	}

	private _onDidClose = new EventEmitter<void>();
	get onDidClose(): Event<void> {
		return this._onDidClose.event;
	}

	private _disposable: Disposable | undefined;
	private readonly _ipc: WebviewIpc;
	private _panel: WebviewPanel | undefined;
	private _streamThread: StreamThread | undefined;

	constructor(public readonly session: CodeStreamSession) {
		super(() => this.dispose());

		this._ipc = new WebviewIpc();
	}

	dispose() {
		this._disposable && this._disposable.dispose();
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

		if (this._panelState.visible !== previous.visible) {
			// HACK: Because messages aren't sent to the webview when hidden, we need to reset the whole view if we are invalid
			if (this._panelState.visible && this._ipc.paused) {
				this.setStream(this._streamThread);
			}

			return;
		}

		// If we aren't visible, there is no point because we can't post any messages
		if (!this._panelState.visible) return;

		if (this._panelState.active !== previous.active) {
			if (this._panelState.active && window.state.focused) {
				this._ipc.onFocus();
			} else if (!this._panelState.active) {
				this._ipc.onBlur();
			}
		}
	}

	private async onPanelWebViewMessageReceived(e: CSWebviewMessage) {
		const { type } = e;

		switch (type.replace("codestream:", "")) {
			case "request": {
				const body = e.body as CSWebviewRequest;
				// TODO: Add sequence ids to ensure correct matching
				// TODO: Add exception handling for failed requests
				switch (body.action) {
					case "create-post": {
						const { text, codeBlocks, parentPostId, streamId, teamId } = body.params;

						let post;
						if (codeBlocks === undefined || codeBlocks.length === 0) {
							post = await this.session.api.createPost(text, parentPostId, streamId, teamId);
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

							let uri;
							if (block.source) {
								uri = Uri.file(path.join(block.source.repoPath, block.source.file));
							} else {
								// TODO: Need the workspace folder or some way of rehyrating the absolute path
								// const folder = workspace.getWorkspaceFolder()
								uri = Uri.file(block.file!);
							}

							post = await Container.agent.postCode(
								uri,
								text,
								block.code,
								block.location,
								block.source,
								parentPostId,
								streamId
							);
						}

						const responseBody: { [key: string]: any } = {
							id: body.id
						};
						if (post === undefined) {
							responseBody.error = "Failed to create post";
						} else {
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
					case "create-stream": {
						const { type, teamId, name, privacy, memberIds } = body.params;
						let stream;
						if (type === "channel") {
							stream = await this.session.api.createChannelStream(name, memberIds, privacy, teamId);
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
							body: { id: body.id, payload: await this.session.api.invite(email, teamId, fullName) }
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
					case "update-stream": {
						const { streamId, update } = body.params;
						const responseBody: { [key: string]: any } = { id: body.id };
						try {
							responseBody.payload = await this.session.api.updateStream(streamId, update);
						} catch (error) {
							if (!error.message.includes("403")) {
								responseBody.error = error.message;
							}
						} finally {
							this.postMessage({
								type: "codestream:response",
								body: responseBody
							});
						}
						break;
					}
				}
				break;
			}
			case "interaction:thread-selected": {
				// Really means post selected
				const { threadId, streamId, post } = e.body;
				if (this._streamThread !== undefined && this._streamThread.stream.id === streamId) {
					this._streamThread.id = threadId;
					this._onDidChangeStream.fire(this._streamThread);
				}

				if (post.codeBlocks == null || post.codeBlocks.length === 0) return;

				const stream = await this.session.getStream(streamId);
				void (await Container.commands.openPostWorkingFile(new Post(this.session, post, stream)));
				break;
			}
			case "interaction:changed-active-stream": {
				const streamId = e.body;

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
			// switch (body.name) {
			// 	case "post-clicked":
			// 		if (body.payload.codeBlocks === undefined) return;

			// 		await Container.commands.openPostWorkingFile(
			// 			new Post(this.session, body.payload, this._streamThread.stream)
			// 		);
			// 		break;

			// 	case "post-diff-clicked":
			// 		if (body.payload === undefined) return;

			// 		await Container.commands.comparePostFileRevisionWithWorking(
			// 			new Post(this.session, body.payload, this._streamThread.stream)
			// 		);
			// 		break;
		}
	}

	private onPostsReceived(e: PostsReceivedEvent) {
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
				this.postMessage({
					type: "codestream:data",
					body: {
						type: e.type,
						payload: e.entities()
					}
				});
				break;
		}
	}

	private onWindowStateChanged(e: WindowState) {
		if (this._panelState.visible && this._panelState.active) {
			if (e.focused) {
				this._ipc.onFocus();
			} else {
				this._ipc.onBlur();
			}
		}
	}

	get streamThread() {
		return this._streamThread;
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
		}
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
				location: [range.start.line, range.start.character, range.end.line, range.end.character],
				source: source
			}
		}));
		return this._streamThread;
	}

	show(streamThread?: StreamThread) {
		if (
			this._panel !== undefined &&
			(streamThread === undefined ||
				(this._streamThread &&
					this._streamThread.id === streamThread.id &&
					this._streamThread.stream.id === streamThread.stream.id))
		) {
			this._panel.reveal(undefined, false);

			return this._streamThread;
		}

		return this.setStream(streamThread);
	}

	private async getHtml(): Promise<string> {
		if (Logger.isDebugging) {
			return new Promise<string>((resolve, reject) => {
				fs.readFile(Container.context.asAbsolutePath("webview.html"), "utf8", (err, data) => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		}

		const doc = await workspace.openTextDocument(Container.context.asAbsolutePath("webview.html"));
		return doc.getText();
	}

	private postMessage(request: CSWebviewMessage) {
		return this._ipc.postMessage(request);
	}

	private async setStream(streamThread?: StreamThread): Promise<StreamThread | undefined> {
		let html = loadingHtml;
		if (this._panel === undefined) {
			this._panel = window.createWebviewPanel(
				"CodeStream.stream",
				"CodeStream",
				{ viewColumn: ViewColumn.Three, preserveFocus: false },
				{
					retainContextWhenHidden: true,
					enableFindWidget: true,
					enableCommandUris: true,
					enableScripts: true
				}
			);

			this._ipc.reset(this._panel);

			this._disposable = Disposable.from(
				this.session.onDidReceivePosts(this.onPostsReceived, this),
				this.session.onDidChange(this.onSessionChanged, this),
				this._panel,
				this._panel.onDidDispose(this.onPanelDisposed, this),
				this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
				this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this),
				window.onDidChangeWindowState(this.onWindowStateChanged, this)
			);

			this._panel.webview.html = html;
		} else {
			this._ipc.reset(this._panel);

			this._panel.webview.html = html;
			this._panel.reveal(ViewColumn.Three, false);
		}

		const state: BootstrapState = Object.create(null);

		if (this.session.status === SessionStatus.SignedIn) {
			const [repos, streams, teams, users, currentUser] = await Promise.all([
				this.session.repos.entities(),
				Container.session.channels.entities(),
				this.session.teams.entities(),
				this.session.users.entities(),
				this.session.api.getMe()
			]);

			state.currentTeamId = this.session.team.id;
			state.currentUserId = this.session.userId;
			if (streamThread !== undefined) {
				state.currentStreamId = streamThread.stream.id;
				state.selectedPostId = streamThread.id;
			}
			state.repos = repos;
			state.streams = streams;
			state.teams = teams;
			state.users = users.map(user => (user.id === currentUser.id ? currentUser : user));
		}
		this._streamThread = streamThread;
		this._onDidChangeStream.fire(this._streamThread);

		const content = await this.getHtml();
		html = content
			.replace(
				/{{root}}/g,
				Uri.file(Container.context.asAbsolutePath("."))
					.with({ scheme: "vscode-resource" })
					.toString()
			)
			.replace("'{{bootstrap}}'", JSON.stringify(state));

		this._panel.webview.html = html;
		this._panel.reveal(ViewColumn.Three, false);

		return this._streamThread;
	}
}

class WebviewIpc {
	private _panel: WebviewPanel | undefined;

	constructor() {}

	private _paused: boolean = false;
	get paused() {
		return this._paused;
	}

	reset(panel: WebviewPanel) {
		this._panel = panel;
		this._paused = false;
	}

	onBlur() {
		this.postMessage({
			type: "codestream:interaction:blur",
			body: {}
		});
	}

	onFocus() {
		this.postMessage({
			type: "codestream:interaction:focus",
			body: {}
		});
	}

	/*private*/ async postMessage(request: CSWebviewMessage) {
		if (this._panel === undefined) throw new Error("Webview has not been created yet");
		if (this._paused) return false;

		const success = await this._panel.webview.postMessage(request);
		if (!success) {
			this._paused = true;
		}
		return success;
	}
}
