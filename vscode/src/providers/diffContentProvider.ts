import { Disposable, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { Container } from "container";
import { Strings } from "system";
import { GetReviewContentsResponse } from "@codestream/protocols/agent";
import { CSReviewCheckpoint } from "@codestream/protocols/api";

export class ReviewDiffContentProvider implements TextDocumentContentProvider, Disposable {
	private readonly _disposable: Disposable;
	private readonly _contents = new Map<string, GetReviewContentsResponse>();

	constructor() {
		this._disposable = Disposable.from(
			workspace.registerTextDocumentContentProvider("codestream-diff", this)
		);
	}

	provideTextDocumentContent(uri: Uri): string {
		const csReviewDiffInfo = Strings.parseCSReviewDiffUrl(uri.toString());
		if (csReviewDiffInfo == null) return "";

		const { reviewId, checkpoint, repoId, version, path } = csReviewDiffInfo;
		const key = this.key(reviewId, checkpoint, repoId, path);

		const contents = this._contents.get(key);
		if (contents === undefined) {
			throw new Error(`Contents not loaded for ${uri}`);
		}

		return (contents as any)[version] as string;
	}

	async loadContents(reviewId: string, checkpoint: CSReviewCheckpoint, repoId: string, path: string) {
		const key = this.key(reviewId, checkpoint, repoId, path);
		const cached = this._contents.get(key);

		if (cached !== undefined) return cached;

		const contents = await Container.agent.reviews.getContents(reviewId, checkpoint, repoId, path);
		this._contents.set(key, contents);

		return contents;
	}

	async loadContentsLocal(repoId: string, path: string, baseSha: string, rightVersion: string) {
		const key = this.key("local", undefined, repoId, path);
		// const cached = this._contents.get(key);

		// if (cached !== undefined) return cached;

		const contents = await Container.agent.reviews.getContentsLocal(
			repoId,
			path,
			baseSha,
			rightVersion
		);
		this._contents.set(key, contents);

		return contents;
	}

	private key(reviewId: string, checkpoint: CSReviewCheckpoint, repoId: string, path: string) {
		return `${reviewId}|${checkpoint}|${repoId}|${path}`;
	}

	dispose() {
		this._disposable.dispose();
	}
}
