// "use strict";
// import { Disposable, Emitter, Event } from "vscode-languageserver";
// import URI from "vscode-uri";
// import { IGitService } from "./gitService";
// import { GitAuthor, GitRemote, GitRemoteType, GitRepository } from "./models/models";

// export * from "./models/models";

// export interface RemoteRepository {
// 	id: string;
// 	hash: string;
// 	normalizedUrl: string;
// 	url: string;
// }

// export class RemoteGitService implements IGitService, Disposable {
// 	constructor(private _repos: RemoteRepository[]) {}

// 	dispose() {}

// 	async getFileAuthors(
// 		uriOrPath: URI | string,
// 		options: { ref?: string; contents?: string; startLine?: number; endLine?: number } = {}
// 	): Promise<GitAuthor[]> {
// 		return [];
// 	}

// 	async getFileCurrentRevision(uriOrPath: URI | string): Promise<string | undefined> {
// 		return undefined;
// 	}

// 	async getFileContentForRevision(
// 		uriOrPath: URI | string,
// 		ref: string
// 	): Promise<string | undefined> {
// 		return undefined;
// 	}

// 	async getFileForRevision(uriOrPath: URI | string, ref: string): Promise<string | undefined> {
// 		return undefined;
// 	}

// 	async getRepoFirstCommits(repoUriOrPath: URI | string): Promise<string[]> {
// 		// const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

// 		const repo = this._repos[0]; // .find(r => r.url === repoPath))
// 		return [repo.hash];
// 	}

// 	async getRepoRemote(repoUriOrPath: URI | string): Promise<GitRemote | undefined> {
// 		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

// 		const repo = this._repos[0]; // .find(r => r.url === repoPath))
// 		const uri = URI.parse(repo.url);

// 		let urlPath = uri.path[0] === "/" ? uri.path.substr(1) : uri.path;
// 		if (urlPath.endsWith(".git")) {
// 			urlPath = urlPath.substr(0, urlPath.length - 4);
// 		}
// 		return new GitRemote(
// 			repoPath,
// 			repo.normalizedUrl,
// 			repo.url,
// 			uri.scheme,
// 			uri.authority,
// 			urlPath,
// 			[{ type: GitRemoteType.Push, url: repo.url }]
// 		);
// 	}

// 	protected _repositories: GitRepository[] | undefined;
// 	async getRepositories(): Promise<GitRepository[]> {
// 		if (this._repositories === undefined) {
// 			this._repositories = this._repos.map(
// 				r =>
// 					new GitRepository(
// 						URI.parse(r.url)
// 							.with({ scheme: "vsls" })
// 							.toString(),
// 						false,
// 						undefined!,
// 						undefined!
// 					)
// 				// new GitRepository(Uri.parse(r.url).with({ scheme: "vsls" }), this)
// 			);
// 		}
// 		return this._repositories;
// 	}

// 	async getRepositoryById(id: string): Promise<GitRepository | undefined> {
// 		return undefined;
// 	}

// 	async getRepositoryByFilePath(filePath: string): Promise<GitRepository | undefined> {
// 		return undefined;
// 	}

// 	async resolveRef(uri: URI, ref: string): Promise<string | undefined>;
// 	async resolveRef(path: string, ref: string): Promise<string | undefined>;
// 	async resolveRef(uriOrPath: URI | string, ref: string): Promise<string | undefined> {
// 		return ref;
// 	}
// }
