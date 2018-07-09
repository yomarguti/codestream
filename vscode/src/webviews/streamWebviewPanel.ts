"use strict";
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
	workspace
} from "vscode";
import { CSCodeBlock, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "../api/api";
import {
	CodeStreamSession,
	Post,
	PostsReceivedEvent,
	SessionChangedEvent,
	SessionChangedType,
	StreamThread
} from "../api/session";
import { Container } from "../container";
import { Logger } from "../logger";
import * as fs from "fs";

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
	private _onDidClose = new EventEmitter<void>();
	get onDidClose(): Event<void> {
		return this._onDidClose.event;
	}

	private _disposable: Disposable | undefined;
	private _panel: WebviewPanel | undefined;
	private _streamThread: StreamThread | undefined;
	private _activeStreamId: string | undefined;

	constructor(public readonly session: CodeStreamSession) {
		super(() => this.dispose());
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onPanelDisposed() {
		this._onDidClose.fire();
	}

	private _invalidateOnVisible: boolean = false;
	private onPanelViewStateChanged(e: WebviewPanelOnDidChangeViewStateEvent) {
		Logger.log("WebView.ViewStateChanged", e.webviewPanel.visible);
		// HACK: Because messages aren't sent to the webview when hidden, we need to reset the whole view if we are invalid
		if (this._invalidateOnVisible && e.webviewPanel.visible) {
			this._invalidateOnVisible = false;
		}
	}

	private async onPanelWebViewMessageReceived(e: CSWebviewMessage) {
		const { type } = e;

		switch (type.replace("codestream:", "")) {
			case "request":
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
							const block = codeBlocks[0];
							const gitRepos = await Container.git.getRepositories();
							const gitRepo = gitRepos.find(r => r.containsFile(block.file));
							const commitHash = (await gitRepo!.getCurrentCommit()) || "";

							// TODO: use repo remotes instead of repoId
							const fileStream = {
								file: block.file,
								repoId: ""
							};

							post = this.session.api.createPostWithCode(
								text,
								parentPostId,
								block.code,
								block.location,
								commitHash,
								fileStream,
								streamId,
								teamId
							);
						}

						if (post === undefined) return;

						this.postMessage({
							type: "codestream:response",
							body: {
								id: body.id,
								payload: post
							}
						});
						break;
					}
					case "fetch-posts": {
						const { streamId, teamId } = body.params;
						return this.postMessage({
							type: "codestream:response",
							body: {
								id: body.id,
								payload: await this.session.api.getPosts(streamId, teamId)
							}
						});
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
						return this.postMessage({
							type: "codestream:response",
							body: { id: body.id, payload: stream }
						});
					}
					case "save-user-preference": {
						const response = await this.session.api.savePreferences(body.params);
						return this.postMessage({
							type: "codestream:response",
							body: { id: body.id, payload: response }
						});
					}
					case "invite": {
						const { email, teamId, fullName } = body.params;
						return this.postMessage({
							type: "codestream:response",
							body: { id: body.id, payload: await this.session.api.invite(email, teamId, fullName) }
						});
					}
				}
				break;

			case "interaction:thread-selected": {
				const { streamId, post } = e.body;

				const stream = await this.session.getStream(streamId);

				if (post.codeBlocks === undefined) return;
				await Container.commands.openPostWorkingFile(new Post(this.session, post, stream));
				break;
			}
			case "interaction:changed-active-stream": {
				this._activeStreamId = e.body;
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
			type: "push-data",
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
				this.postMessage({
					type: "push-data",
					body: {
						type: e.type,
						payload: e.entities()
					}
				});
				break;
		}
	}

	get activeStreamId() {
		return this._activeStreamId;
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

	postCode(
		repoId: string,
		relativePath: string,
		code: string,
		range: Range,
		commitHash: string,
		text?: string,
		mentions: string = ""
	) {
		return this.postMessage({
			type: "codestream:interaction:code-highlighted",
			body: {
				quoteRange: [range.start.line, range.start.character, range.end.line, range.end.character],
				quoteText: code,
				authors: mentions.split(" "),
				file: relativePath
			}
		});
	}

	show(streamThread?: StreamThread) {
		if (streamThread) {
			// return this.setStream(streamThread);
		}

		return this._show();
	}

	private async getHtml(): Promise<string> {
		if (Logger.isDebugging) {
			return new Promise<string>((resolve, reject) => {
				fs.readFile(Container.context.asAbsolutePath("/assets/index.html"), "utf8", (err, data) => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
		}

		const doc = await workspace.openTextDocument(
			Container.context.asAbsolutePath("/assets/index.html")
		);
		return doc.getText();
	}

	private async postMessage(request: CSWebviewMessage) {
		const success = await this._panel!.webview.postMessage(request);
		if (!success) {
			this._invalidateOnVisible = true;
		}
	}

	private async _show() {
		const title = "CodeStream";
		let html = loadingHtml;
		if (this._panel === undefined) {
			this._panel = window.createWebviewPanel(
				"CodeStream.stream",
				title,
				{ viewColumn: ViewColumn.Three, preserveFocus: false },
				{
					retainContextWhenHidden: true,
					enableFindWidget: true,
					enableCommandUris: true,
					enableScripts: true
				}
			);

			this._disposable = Disposable.from(
				this.session.onDidReceivePosts(this.onPostsReceived, this),
				this.session.onDidChange(this.onSessionChanged, this),
				this._panel,
				this._panel.onDidDispose(this.onPanelDisposed, this),
				this._panel.onDidChangeViewState(this.onPanelViewStateChanged, this),
				this._panel.webview.onDidReceiveMessage(this.onPanelWebViewMessageReceived, this)
			);

			this._panel.webview.html = html;
		} else {
			this._panel.title = title;
			this._panel.webview.html = html;
			this._panel.reveal(ViewColumn.Three, false);
		}

		const [content, repos, streams, teams, users] = await Promise.all([
			this.getHtml(),
			this.session.repos.entities(),
			Container.session.channels.entities(),
			this.session.teams.entities(),
			this.session.users.entities()
		]);

		const state: BootstrapState = Object.create(null);
		state.currentTeamId = this.session.team.id;
		state.currentUserId = this.session.userId;

		// state.posts = posts;
		state.repos = repos;
		state.streams = streams;
		state.teams = teams;
		state.users = users;

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
	}
}
