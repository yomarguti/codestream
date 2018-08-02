"use strict";
import { Uri } from "vscode";
import { IGitService } from "./gitService";
import { GitRemote, GitRemoteType, GitRepository } from "./models/models";

export * from "./models/models";

export interface RemoteRepository {
	id: string;
	hash: string;
	normalizedUrl: string;
	url: string;
}

export class RemoteGitService implements IGitService {
	constructor(private _repos: RemoteRepository[]) {}

	async getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined> {
		return undefined;
	}

	async getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
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
		let uri;
		try {
			uri = Uri.parse(repo.url);
		} catch {
			uri = Uri.parse(repo.normalizedUrl);
		}

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
			this._repositories = this._repos.map(r => {
				let uri;
				try {
					uri = Uri.parse(r.url);
				} catch {
					uri = Uri.parse(r.normalizedUrl);
				}
				return new GitRepository(uri.with({ scheme: "vsls" }));
			});
		}
		return this._repositories;
	}
}
