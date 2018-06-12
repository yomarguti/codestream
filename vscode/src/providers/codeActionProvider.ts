"use strict";
import {
	CancellationToken,
	CodeActionContext,
	CodeActionProvider,
	Command,
	Disposable,
	DocumentSelector,
	languages,
	Range,
	TextDocument
} from "vscode";
import { PostCodeCommandArgs } from "../commands";

export class CodeStreamCodeActionProvider extends Disposable implements CodeActionProvider {
	static selector: DocumentSelector = [{ scheme: "file" }, { scheme: "vsls" }];

	private readonly _disposable: Disposable | undefined;

	constructor() {
		super(() => this.dispose());

		this._disposable = languages.registerCodeActionsProvider(
			CodeStreamCodeActionProvider.selector,
			this
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	provideCodeActions(
		document: TextDocument,
		range: Range,
		context: CodeActionContext,
		token: CancellationToken
	): Command[] | Thenable<Command[]> {
		if (range.start.compareTo(range.end) === 0) return [];

		return [
			{
				title: `Add CodeStream Comment`,
				command: "codestream.postCode",
				arguments: [
					{
						document: document
						// range: range // Since the range is untrustworthy, don't sent it -- the command will try to get this from the active editor
					} as PostCodeCommandArgs
				]
			} as Command
		];
	}
}
