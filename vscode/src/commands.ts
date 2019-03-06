import { CodemarkType, CSMarkerIdentifier } from "@codestream/protocols/api";
import * as paths from "path";
import {
	commands,
	Disposable,
	Range,
	Uri,
	ViewColumn,
	window,
	workspace,
	WorkspaceEdit
} from "vscode";
import { StreamThread } from "./api/session";
import { TokenManager } from "./api/tokenManager";
import { WorkspaceState } from "./common";
import { BuiltInCommands } from "./constants";
import { Container } from "./container";
import { Logger } from "./logger";
import { Command, createCommandDecorator } from "./system";

const commandRegistry: Command[] = [];
const command = createCommandDecorator(commandRegistry);

export interface ApplyMarkerCommandArgs {
	marker: CSMarkerIdentifier;
}

export interface ShowMarkerDiffCommandArgs {
	marker: CSMarkerIdentifier;
}

export interface OpenCodemarkCommandArgs {
	codemarkId: string;
	streamThread?: StreamThread;
}

export interface OpenStreamCommandArgs {
	streamThread: StreamThread;
}

export class Commands implements Disposable {
	private readonly _disposable: Disposable;

	constructor() {
		this._disposable = Disposable.from(
			...commandRegistry.map(({ name, key, method }) =>
				commands.registerCommand(name, (...args: any[]) => method.apply(this, args))
			),
			commands.registerCommand("workbench.view.extension.codestream", () =>
				Container.webview.show()
			)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	@command("goOffline")
	goOffline() {
		return Container.session.goOffline();
	}

	@command("applyMarker", { showErrorMessage: "Unable to open comment" })
	async applyMarker(args: ApplyMarkerCommandArgs): Promise<boolean> {
		const editor = await this.openWorkingFileForMarkerCore(args.marker);
		if (editor === undefined) return false;

		const resp = await Container.agent.getDocumentFromMarker(args.marker);
		if (resp === undefined) return false;

		return editor.edit(builder => {
			builder.replace(
				new Range(
					resp.range.start.line,
					resp.range.start.character,
					resp.range.end.line,
					resp.range.end.character
				),
				resp.marker.code
			);
		});
	}

	@command("showMarkerDiff", { showErrorMessage: "Unable to open comment" })
	async showMarkerDiff(args: ShowMarkerDiffCommandArgs): Promise<boolean> {
		const resp = await Container.agent.getDocumentFromMarker(args.marker);
		if (resp === undefined) return false;

		const original = await workspace.openTextDocument(Uri.parse(resp.textDocument.uri));

		const patched = await workspace.openTextDocument({
			language: original.languageId,
			content: original.getText()
		});

		const edit = new WorkspaceEdit();
		edit.replace(
			patched.uri,
			new Range(
				resp.range.start.line,
				resp.range.start.character,
				resp.range.end.line,
				resp.range.end.character
			),
			resp.marker.code
		);

		const result = await workspace.applyEdit(edit);
		if (!result) return false;

		// FYI, this doesn't always work, see https://github.com/Microsoft/vscode/issues/56097
		let column = Container.webview.viewColumn as number | undefined;
		if (column !== undefined) {
			column--;
			if (column <= 0) {
				column = undefined;
			}
		}

		const fileName = paths.basename(original.fileName);
		await commands.executeCommand(
			BuiltInCommands.Diff,
			original.uri,
			patched.uri,
			`${fileName} \u27f7 ${fileName} (patched)`,
			{
				preserveFocus: false,
				preview: true,
				viewColumn: column || ViewColumn.Beside
			}
		);

		return true;
	}

	@command("newComment", { showErrorMessage: "Unable to add comment" })
	newComment() {
		return this.newCodemarkRequest(CodemarkType.Comment);
	}

	@command("newIssue", { showErrorMessage: "Unable to add issue" })
	newIssue() {
		return this.newCodemarkRequest(CodemarkType.Issue);
	}

	@command("newBookmark", { showErrorMessage: "Unable to add bookmark" })
	newBookmark() {
		return this.newCodemarkRequest(CodemarkType.Bookmark);
	}

	@command("newLink", { showErrorMessage: "Unable to get permalink" })
	newLink() {
		return this.newCodemarkRequest(CodemarkType.Link);
	}

	@command("openCodemark", { showErrorMessage: "Unable to open comment" })
	async openCodemark(args: OpenCodemarkCommandArgs): Promise<void> {
		Container.agent.telemetry.track("Codemark Clicked", { "Codemark Location": "Source File" });
		return Container.webview.openCodemark(args.codemarkId, args.streamThread);
	}

	@command("openStream", { showErrorMessage: "Unable to open stream" })
	async openStream(args: OpenStreamCommandArgs): Promise<StreamThread | undefined> {
		if (args == null || args.streamThread === undefined) return undefined;

		return Container.webview.show(args.streamThread);
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

	private async newCodemarkRequest(type: CodemarkType) {
		const editor = window.activeTextEditor;
		if (editor === undefined) return;

		await Container.webview.newCodemarkRequest(type, editor);
	}

	private async openWorkingFileForMarkerCore(marker: CSMarkerIdentifier) {
		const resp = await Container.agent.getDocumentFromMarker(marker);
		if (resp === undefined || resp === null) return undefined;

		const uri = Uri.parse(resp.textDocument.uri);
		const normalizedUri = uri.toString(false);

		const editor = window.activeTextEditor;
		if (editor !== undefined && editor.document.uri.toString(false) === normalizedUri) {
			return editor;
		}

		for (const e of window.visibleTextEditors) {
			if (e.document.uri.toString(false) === normalizedUri) {
				return window.showTextDocument(e.document, e.viewColumn);
			}
		}

		// FYI, this doesn't always work, see https://github.com/Microsoft/vscode/issues/56097
		let column = Container.webview.viewColumn as number | undefined;
		if (column !== undefined) {
			column--;
			if (column <= 0) {
				column = undefined;
			}
		}

		const document = await workspace.openTextDocument();
		return window.showTextDocument(document, {
			preserveFocus: false,
			preview: false,
			viewColumn: column || ViewColumn.Beside
		});
	}
}
