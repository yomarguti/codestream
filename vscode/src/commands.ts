import {
	commands,
	Disposable,
	Position,
	Range,
	TextDocument,
	Uri,
	ViewColumn,
	window
} from "vscode";
import { CodeStreamSession, Stream, StreamThread, StreamType } from "./api/session";
import { TokenManager } from "./api/tokenManager";
import { openEditor, ShowCodeResult, WorkspaceState } from "./common";
import { Container } from "./container";
import { StreamThreadId } from "./controllers/webviewController";
import { Logger } from "./logger";
import { CSMarker } from "./shared/api.protocol";
import { Command, createCommandDecorator } from "./system";

const commandRegistry: Command[] = [];
const command = createCommandDecorator(commandRegistry);

export enum BuiltInCommands {
	CloseActiveEditor = "workbench.action.closeActiveEditor",
	CloseAllEditors = "workbench.action.closeAllEditors",
	CursorMove = "cursorMove",
	Diff = "vscode.diff",
	EditorScroll = "editorScroll",
	ExecuteDocumentSymbolProvider = "vscode.executeDocumentSymbolProvider",
	ExecuteCodeLensProvider = "vscode.executeCodeLensProvider",
	Open = "vscode.open",
	NextEditor = "workbench.action.nextEditor",
	PreviewHtml = "vscode.previewHtml",
	RevealLine = "revealLine",
	ReloadWindow = "workbench.action.reloadWindow",
	SetContext = "setContext",
	ShowCodeStream = "workbench.view.extension.codestream",
	ShowReferences = "editor.action.showReferences"
}

type StreamLocator =
	| { type: StreamType.Channel; name: string }
	| { type: StreamType.Direct; members: string[] }
	| { type: StreamType.File; uri: Uri };

interface IRequiresStream {
	streamThread: StreamThread | StreamThreadId | StreamLocator | undefined;
}

export function isStreamThread(
	streamOrThreadOrLocator: Stream | StreamThread | StreamThreadId | StreamLocator
): streamOrThreadOrLocator is StreamThread {
	return (streamOrThreadOrLocator as StreamThread).stream !== undefined;
}

export function isStreamThreadId(
	streamOrThreadOrLocator: Stream | StreamThread | StreamThreadId | StreamLocator
): streamOrThreadOrLocator is StreamThreadId {
	return (streamOrThreadOrLocator as StreamThreadId).streamId !== undefined;
}

export interface OpenPostWorkingFileArgs {
	preserveFocus: boolean;
	source: string;
}

export interface HighlightCodeArgs {
	onOff: boolean;
}

export interface OpenStreamCommandArgs extends IRequiresStream {
	session?: CodeStreamSession;
}

export interface PostCodeCommandArgs extends IRequiresStream {
	document?: TextDocument;
	range?: Range;
	ref?: string;
	text?: string;
	send?: boolean;
	session?: CodeStreamSession;
}

export class Commands implements Disposable {
	private readonly _disposable: Disposable;

	constructor() {
		this._disposable = Disposable.from(
			...commandRegistry.map(({ name, key, method }) =>
				commands.registerCommand(name, (...args: any[]) => method.apply(this, args))
			)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	// @command("comparePostFileRevisionWithWorking", { showErrorMessage: "Unable to open post" })
	// async comparePostFileRevisionWithWorking(post?: Post) {
	// 	if (post == null) return;

	// 	const block = await post.codeBlock();
	// 	if (block === undefined) return;

	// 	const file = await Container.git.getFileRevision(block.uri, block.revision!);
	// 	if (file === undefined) return;

	// 	const filename = path.basename(block.uri.fsPath);

	// 	return commands.executeCommand(
	// 		BuiltInCommands.Diff,
	// 		Uri.file(file),
	// 		block.uri,
	// 		`${filename}${
	// 			block.revision !== undefined ? ` (${block.revision.substr(0, 8)})` : ""
	// 		} \u00a0\u27F7\u00a0 ${filename}`,
	// 		{ preview: true, viewColumn: ViewColumn.Beside, selection: block.range }
	// 	);
	// }

	@command("goOffline")
	goOffline() {
		return Container.session.goOffline();
	}

	@command("openPostWorkingFile", { showErrorMessage: "Unable to open post" })
	async openPostWorkingFile(
		marker?: CSMarker,
		args: OpenPostWorkingFileArgs = { preserveFocus: false, source: "Source File" }
	) {
		if (marker == null) return;

		const resp = await Container.agent.getDocumentFromMarker(marker, args.source);
		if (resp === undefined || resp === null) return ShowCodeResult.RepoNotInWorkspace; // ?: what exactly does no response mean?

		const block = {
			code: marker.code,
			range: new Range(
				resp.range.start.line,
				resp.range.start.character,
				resp.range.end.line,
				resp.range.end.character
			),
			revision: resp.revision,
			uri: Uri.parse(resp.textDocument.uri)
		};

		// FYI, this doesn't always work, see https://github.com/Microsoft/vscode/issues/56097
		let column = Container.webview.viewColumn as number | undefined;
		if (column !== undefined) {
			column--;
			if (column <= 0) {
				column = undefined;
			}
		}

		const pos = new Position(block.range.start.line, 0);
		const range = new Range(pos, pos);

		// TODO: Need to follow marker to current sha
		return openEditor(block.uri, {
			preview: true,
			viewColumn: column || ViewColumn.Beside,
			selection: range,
			preserveFocus: args.preserveFocus
		});
	}

	async highlightCode(marker?: CSMarker, args: HighlightCodeArgs = { onOff: true }) {
		if (marker == null) return;

		const resp = await Container.agent.getDocumentFromMarker(marker);
		if (resp === undefined || resp === null) return ShowCodeResult.RepoNotInWorkspace; // ?: what exactly does no response mean?

		const block = {
			code: marker.code,
			range: new Range(
				resp.range.start.line,
				resp.range.start.character,
				resp.range.end.line,
				resp.range.end.character
			),
			revision: resp.revision,
			uri: Uri.parse(resp.textDocument.uri)
		};

		// FYI, this doesn't always work, see https://github.com/Microsoft/vscode/issues/56097
		let column = Container.webview.viewColumn as number | undefined;
		if (column !== undefined) {
			column--;
			if (column <= 0) {
				column = undefined;
			}
		}

		const range = args.onOff ? block.range : undefined;

		// TODO: Need to follow marker to current sha
		return openEditor(block.uri, {
			preview: true,
			viewColumn: column || ViewColumn.Beside,
			highlight: range
		});
	}

	// @command("openPostFileRevision", { showErrorMessage: "Unable to open post" })
	// async openPostFileRevision(post?: Post) {
	// 	if (post == null) return;

	// 	const block = await post.codeBlock();
	// 	if (block === undefined) return;

	// 	const file = await Container.git.getFileRevision(block.uri, block.revision!);
	// 	if (file === undefined) return;

	// 	return openEditor(Uri.file(file), {
	// 		preview: true,
	// 		viewColumn: ViewColumn.Beside,
	// 		selection: block.range
	// 	});
	// }

	@command("openComment", { showErrorMessage: "Unable to open comment" })
	async openComment(args: OpenStreamCommandArgs): Promise<StreamThread | undefined> {
		Container.agent.telemetry.track("Codemark Clicked", { "Codemark Location": "Source File" });
		return this.openStream(args);
	}

	@command("openStream", { showErrorMessage: "Unable to open stream" })
	async openStream(args: OpenStreamCommandArgs): Promise<StreamThread | undefined> {
		if (args == null) return undefined;

		const streamThread = await this.findStreamThread(args.session || Container.session, args, {
			includeActive: true,
			includeDefault: true
		});
		if (streamThread === undefined) return undefined;

		return Container.webview.show(streamThread);
	}

	@command("postCode", { showErrorMessage: "Unable to add comment" })
	async postCode(args: PostCodeCommandArgs) {
		if (args == null) {
			args = {} as PostCodeCommandArgs;
		}

		let document;
		let selection;
		if (args.document === undefined || args.range === undefined) {
			const editor = window.activeTextEditor;
			if (editor === undefined) return undefined;

			document = editor.document;
			selection = editor.selection;
			if (selection.start.isEqual(selection.end)) return undefined;
		} else {
			({ document, range: selection } = args);
		}

		if (document === undefined || selection === undefined) return undefined;

		const response = await Container.agent.posts.prepareCode(document, selection);
		const streamThread = await Container.webview.postCode(
			response.code,
			document.uri,
			selection,
			response.source,
			response.gitError
		);
		return streamThread !== undefined ? streamThread.stream : undefined;
	}

	@command("signIn", { customErrorHandling: true })
	async signIn() {
		try {
			const token = await TokenManager.get(Container.config.serverUrl, Container.config.email);
			if (!token) {
				await Container.context.workspaceState.update(WorkspaceState.TeamId, undefined);
				await Container.webview.show();
			} else {
				await Container.session.login(Container.config.email, token);
			}
		} catch (ex) {
			Logger.error(ex);
		}
	}

	@command("signOut")
	async signOut() {
		try {
			return await Container.session.logout();
		} catch (ex) {
			Logger.error(ex);
		}
	}

	@command("toggle")
	async toggle() {
		try {
			return await Container.webview.toggle();
		} catch (ex) {
			Logger.error(ex);
		}
	}

	private async findStreamThread(
		session: CodeStreamSession,
		threadOrLocator: IRequiresStream,
		options: { includeActive?: boolean; includeDefault?: boolean } = {}
	): Promise<StreamThread | undefined> {
		if (threadOrLocator !== undefined && threadOrLocator.streamThread !== undefined) {
			if (isStreamThread(threadOrLocator.streamThread)) return threadOrLocator.streamThread;

			if (isStreamThreadId(threadOrLocator.streamThread)) {
				const stream = await session.getStream(threadOrLocator.streamThread.streamId);
				return stream !== undefined
					? { id: threadOrLocator.streamThread.id, stream: stream }
					: undefined;
			}

			const locator = threadOrLocator.streamThread;

			let stream;
			switch (locator.type) {
				case StreamType.Channel:
					stream = await session.getChannelByName(locator.name);
					break;

				case StreamType.Direct:
					stream = await session.getDMByMembers(locator.members);
					break;

				// case StreamType.File:
				// 	const repo = await session.repos.getByFileUri(locator.uri);
				// 	if (repo !== undefined) {
				// 		if (locator.create) {
				// 			return { id: undefined, stream: await repo.streams.getOrCreateByUri(locator.uri) };
				// 		}

				// 		stream = await repo.streams.getByUri(locator.uri);
				// 		break;
				// 	}
			}

			if (stream !== undefined) return { id: undefined, stream: stream };
		}

		let streamThread;
		if (options.includeActive) {
			streamThread = Container.webview.activeStreamThread;
		}

		// if (streamThread === undefined && options.includeDefault) {
		// 	streamThread = { id: undefined, stream: await session.getDefaultTeamChannel() };
		// }

		return streamThread;
	}
}
