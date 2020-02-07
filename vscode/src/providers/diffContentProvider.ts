import { Disposable, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { Container } from "container";
import { GetReviewContentsResponse } from "@codestream/protocols/agent";

export class ReviewDiffContentProvider implements TextDocumentContentProvider, Disposable {
	private readonly _disposable: Disposable;
	private readonly _contents = new Map<string, GetReviewContentsResponse>();
	private readonly urlRegexp = /codestream-diff:\/\/(\w+)\/(\w+)\/(\w+)\/(.+)/;

	constructor() {
		this._disposable = Disposable.from(
			workspace.registerTextDocumentContentProvider("codestream-diff", this)
		);
	}

	provideTextDocumentContent(uri: Uri): string {
		const match = this.urlRegexp.exec(uri.toString());
		if (match === null) return "";

		const [, changesetId, repoId, version, path] = match;
		const key = this.key(changesetId, repoId, path);

		const contents = this._contents.get(key);
		if (contents === undefined) {
			throw new Error(`Contents not loaded for ${uri}`);
		}

		return (contents as any)[version] as string;
	}

	async loadContents(changesetId: string, repoId: string, path: string) {
		const key = this.key(changesetId, repoId, path);
		const cached = this._contents.get(key);

		if (cached !== undefined) return cached;

		const contents = await Container.agent.reviews.getContents(changesetId, repoId, path);
		this._contents.set(key, contents);

		return contents;
	}

	private key(changesetId: string, repoId: string, path: string) {
		return `${changesetId}|${repoId}|${path}`;
	}

	dispose() {
		this._disposable.dispose();
	}
}
