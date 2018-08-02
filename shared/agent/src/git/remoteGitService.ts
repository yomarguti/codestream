"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import Uri from "vscode-uri";
import { IGitService } from "./gitService";
import { GitAuthor, GitRemote, GitRemoteType, GitRepository } from "./models/models";

export * from "./models/models";

export interface RemoteRepository {
	id: string;
	hash: string;
	normalizedUrl: string;
	url: string;
}

export class RemoteGitService implements IGitService, Disposable {
	private _onDidChangeRepositories = new Emitter<void>();
	get onDidChangeRepositories(): Event<void> {
		return this._onDidChangeRepositories.event;
	}

	constructor(private _repos: RemoteRepository[]) {}

	dispose() {}

	async getFileAuthors(
		uriOrPath: Uri | string,
		options: { ref?: string; contents?: string; startLine?: number; endLine?: number } = {}
	): Promise<GitAuthor[]> {
		return [];
	}

	async getFileCurrentRevision(uriOrPath: Uri | string): Promise<string | undefined> {
		return undefined;
	}

	async getFileContentForRevision(
		uriOrPath: Uri | string,
		ref: string
	): Promise<string | undefined> {
		return undefined;
	}

	async getFileForRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
		return undefined;
	}

	async getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]> {
		// const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

		const repo = this._repos[0]; // .find(r => r.url === repoPath))
		return [repo.hash];
	}

	async getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

		const repo = this._repos[0]; // .find(r => r.url === repoPath))
		const uri = Uri.parse(repo.url);

		let urlPath = uri.path[0] === "/" ? uri.path.substr(1) : uri.path;
		if (urlPath.endsWith(".git")) {
			urlPath = urlPath.substr(0, urlPath.length - 4);
		}
		return new GitRemote(
			repoPath,
			repo.normalizedUrl,
			repo.url,
			uri.scheme,
			uri.authority,
			urlPath,
			[{ type: GitRemoteType.Push, url: repo.url }]
		);
	}

	protected _repositories: GitRepository[] | undefined;
	async getRepositories(): Promise<GitRepository[]> {
		if (this._repositories === undefined) {
			this._repositories = this._repos.map(
				r => new GitRepository(Uri.parse(r.url).with({ scheme: "vsls" }), this)
				// new GitRepository(Uri.parse(r.url).with({ scheme: "vsls" }), this)
			);
		}
		return this._repositories;
	}

	async resolveRef(uri: Uri, ref: string): Promise<string | undefined>;
	async resolveRef(path: string, ref: string): Promise<string | undefined>;
	async resolveRef(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
		return ref;
	}
}
