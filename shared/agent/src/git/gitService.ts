"use strict";
import { IUniDiff, parsePatch } from "diff";
import * as fs from "fs";
import * as path from "path";
import { Disposable } from "vscode-languageserver";
import URI from "vscode-uri";
import { CodeStreamApi } from "../api/api";
import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import { Strings } from "../system";
import { git, GitErrors, GitWarnings } from "./git";
import { GitAuthor, GitRemote, GitRepository } from "./models/models";
import { GitAuthorParser } from "./parsers/authorParser";
import { GitRemoteParser } from "./parsers/remoteParser";
import { GitRepositories } from "./repositories";

export * from "./models/models";

export interface IGitService extends Disposable {
	getFileAuthors(
		uri: URI,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	getFileAuthors(
		path: string,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	// getFileAuthors(uriOrPath: Uri | string, options?: { ref?: string, contents?: string, startLine?: number, endLine?: number }): Promise<GitAuthor[]>;

	getFileCurrentRevision(uri: URI): Promise<string | undefined>;
	getFileCurrentRevision(path: string): Promise<string | undefined>;
	// getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined>;

	getFileForRevision(uri: URI, ref: string): Promise<string | undefined>;
	getFileForRevision(path: string, ref: string): Promise<string | undefined>;
	// getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined>;

	getFileContentForRevision(uri: URI, ref: string): Promise<string | undefined>;
	getFileContentForRevision(path: string, ref: string): Promise<string | undefined>;
	// getFileRevisionContent(uriOrPath: Uri | string, ref: string): Promise<string | undefined>;

	getRepoFirstCommits(repoUri: URI): Promise<string[]>;
	getRepoFirstCommits(repoPath: string): Promise<string[]>;
	// getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]>;

	getRepoHeadRevision(repoUri: URI): Promise<string | undefined>;
	getRepoHeadRevision(repoPath: string): Promise<string | undefined>;

	getRepoRemote(repoUri: URI): Promise<GitRemote | undefined>;
	getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
	// getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined>;

	getRepoRoot(uri: URI, isDirectory?: boolean): Promise<string | undefined>;
	getRepoRoot(path: string, isDirectory?: boolean): Promise<string | undefined>;

	getRepositories(): Promise<Iterable<GitRepository>>;
	getRepositoryById(id: string): Promise<GitRepository | undefined>;
	getRepositoryByFilePath(filePath: string): Promise<GitRepository | undefined>;

	resolveRef(uri: URI, ref: string): Promise<string | undefined>;
	resolveRef(path: string, ref: string): Promise<string | undefined>;
	//   resolveRef(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
}

export class GitService implements IGitService, Disposable {
	private _disposable: Disposable | undefined;
	private readonly _repositories: GitRepositories;

	constructor(public readonly session: CodeStreamSession, api: CodeStreamApi) {
		this._repositories = new GitRepositories(this, session, api);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	async getFileAuthors(
		uri: URI,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	async getFileAuthors(
		path: string,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	async getFileAuthors(
		uriOrPath: URI | string,
		options: { ref?: string; contents?: string; startLine?: number; endLine?: number } = {}
	): Promise<GitAuthor[]> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		const params = ["blame", "--root", "--incremental", "-w"];

		if (options.startLine != null && options.endLine != null) {
			params.push(`-L ${options.startLine + 1},${options.endLine + 1}`);
		}

		let stdin;
		if (options.ref) {
			params.push(options.ref);
		} else if (options.contents) {
			params.push("--contents", "-");
			// Pipe the blame contents to stdin
			stdin = options.contents;
		}

		const data = await git({ cwd: dir, stdin: stdin }, ...params, "--", filename);
		return GitAuthorParser.parse(data);
	}

	async getFileCurrentRevision(uri: URI): Promise<string | undefined>;
	async getFileCurrentRevision(path: string): Promise<string | undefined>;
	async getFileCurrentRevision(uriOrPath: URI | string): Promise<string | undefined> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		const data = (await git({ cwd: dir }, "log", "-n1", "--format=%H", "--", filename)).trim();
		return data ? data : undefined;
	}

	async getFileContentForRevision(uri: URI, ref: string): Promise<string | undefined>;
	async getFileContentForRevision(path: string, ref: string): Promise<string | undefined>;
	async getFileContentForRevision(
		uriOrPath: URI | string,
		ref: string
	): Promise<string | undefined> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		try {
			const data = await git({ cwd: dir, encoding: "utf8" }, "show", `${ref}:./${filename}`, "--");
			return data;
		} catch (ex) {
			const msg = ex && ex.toString();
			if (
				GitErrors.badRevision.test(msg) ||
				GitWarnings.notFound.test(msg) ||
				GitWarnings.foundButNotInRevision.test(msg)
			) {
				return undefined;
			}

			throw ex;
		}
	}

	async getDiffBetweenCommits(
		initialCommitHash: string,
		finalCommitHash: string,
		filePath: string
	): Promise<IUniDiff> {
		const [dir, filename] = Strings.splitPath(filePath);
		let data;
		try {
			data = await git({ cwd: dir }, "diff", initialCommitHash, finalCommitHash, "--", filename);
		} catch (err) {
			Logger.warn(
				`Error getting diff from ${initialCommitHash} to ${finalCommitHash} for ${filename}`
			);
			throw err;
		}

		const patches = parsePatch(data);
		if (patches.length > 1) {
			Logger.warn("Parsed diff generated multiple patches");
		}
		return patches[0];
	}

	async getDiffFromHead(filePath: string): Promise<IUniDiff> {
		const [dir, filename] = Strings.splitPath(filePath);
		let data;
		try {
			data = await git({ cwd: dir }, "diff", "HEAD", "--", filename);
		} catch (err) {
			Logger.warn(`Error getting diff from HEAD to working directory for ${filename}`);
			throw err;
		}

		const patches = parsePatch(data);
		if (patches.length > 1) {
			Logger.warn("Parsed diff generated multiple patches");
		}
		return patches[0];
	}

	async getFileForRevision(uri: URI, ref: string): Promise<string | undefined>;
	async getFileForRevision(path: string, ref: string): Promise<string | undefined>;
	async getFileForRevision(uriOrPath: URI | string, ref: string): Promise<string | undefined> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		let data: string | undefined;
		try {
			data = await git({ cwd: dir, encoding: "binary" }, "show", `${ref}:./${filename}`);
		} catch (ex) {
			const msg = ex && ex.toString();
			if (!GitWarnings.notFound.test(msg) && GitWarnings.foundButNotInRevision.test(msg)) throw ex;
		}

		if (!data) return undefined;

		const suffix = Strings.sanitizeForFileSystem(ref.substr(0, 8)).substr(0, 50);
		const ext = path.extname(filename);

		const tmp = await import(/* webpackChunkName: "tmp", webpackMode: "eager" */ "tmp");
		return new Promise<string>((resolve, reject) => {
			tmp.file(
				{ prefix: `${path.basename(filename, ext)}-${suffix}__`, postfix: ext },
				(err, destination, fd, cleanupCallback) => {
					if (err) {
						reject(err);
						return;
					}

					fs.appendFile(destination, data, { encoding: "binary" }, err => {
						if (err) {
							reject(err);
							return;
						}

						const ReadOnly = 0o100444; // 33060 0b1000000100100100
						fs.chmod(destination, ReadOnly, err => {
							resolve(destination);
						});
					});
				}
			);
		});
	}

	async getRepoFirstCommits(repoUri: URI): Promise<string[]>;
	async getRepoFirstCommits(repoPath: string): Promise<string[]>;
	async getRepoFirstCommits(repoUriOrPath: URI | string): Promise<string[]> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

		let data;
		try {
			data = await git(
				{ cwd: repoPath },
				"rev-list",
				"--max-parents=0",
				"--reverse",
				"master",
				"--"
			);
		} catch {}

		if (!data) {
			try {
				data = await git(
					{ cwd: repoPath },
					"rev-list",
					"--max-parents=0",
					"--reverse",
					"HEAD",
					"--"
				);
			} catch {}
		}

		if (!data) return [];

		return data.trim().split("\n");
	}

	async getRepoHeadRevision(repoUri: URI): Promise<string | undefined>;
	async getRepoHeadRevision(repoPath: string): Promise<string | undefined>;
	async getRepoHeadRevision(repoUriOrPath: URI | string): Promise<string | undefined> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

		const data = (await git({ cwd: repoPath }, "log", "-n1", "--format=%H")).trim();
		return data ? data : undefined;
	}

	async getRepoRemote(repoUri: URI): Promise<GitRemote | undefined>;
	async getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
	async getRepoRemote(repoUriOrPath: URI | string): Promise<GitRemote | undefined> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;
		const remotes = await this.getRepoRemotes(repoPath);

		let fetch;
		let push;
		for (const r of remotes) {
			if (push !== undefined) break;

			if (r.types.find(t => t.type === "push")) {
				push = r;
			} else if (fetch === undefined && r.types.find(t => t.type === "fetch")) {
				fetch = r;
			}
		}

		return push || fetch;
	}

	async getRepoRemotes(repoUri: URI): Promise<GitRemote[]>;
	async getRepoRemotes(repoPath: string): Promise<GitRemote[]>;
	async getRepoRemotes(repoUriOrPath: URI | string): Promise<GitRemote[]> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

		try {
			const data = await git({ cwd: repoPath }, "remote", "-v");
			return GitRemoteParser.parse(data, repoPath);
		} catch {
			return [];
		}
	}

	async repoHasRemote(repoPath: string, remoteUrl: string): Promise<boolean> {
		let data;
		try {
			data = await git({ cwd: repoPath }, "remote", "-v");
			if (!data) return false;
		} catch {
			return false;
		}

		const remotes = GitRemoteParser.parse(data, repoPath);
		for (const r of remotes) {
			if (r.normalizedUrl === remoteUrl) {
				return true;
			}
		}

		return false;
	}

	async getRepoRoot(uri: URI, isDirectory?: boolean): Promise<string | undefined>;
	async getRepoRoot(path: string, isDirectory?: boolean): Promise<string | undefined>;
	async getRepoRoot(
		uriOrPath: URI | string,
		isDirectory: boolean = false
	): Promise<string | undefined> {
		const filePath = typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath;
		let cwd;
		if (isDirectory) {
			cwd = filePath;
		} else {
			[cwd] = Strings.splitPath(filePath);
		}

		try {
			const data = (await git({ cwd: cwd }, "rev-parse", "--show-toplevel")).trim();
			return data === "" ? undefined : data;
		} catch {
			return undefined;
		}
	}

	getRepositories(): Promise<Iterable<GitRepository>> {
		return this._repositories.get();
	}

	getRepositoryById(id: string): Promise<GitRepository | undefined> {
		return this._repositories.getById(id);
	}

	getRepositoryByFilePath(filePath: string): Promise<GitRepository | undefined> {
		return this._repositories.getByFilePath(filePath);
	}

	async resolveRef(uri: URI, ref: string): Promise<string | undefined>;
	async resolveRef(path: string, ref: string): Promise<string | undefined>;
	async resolveRef(uriOrPath: URI | string, ref: string): Promise<string | undefined> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		try {
			const data = await git({ cwd: dir }, "log", "-M", "-n1", "--format=%H", ref, "--", filename);
			return data.trim();
		} catch {
			return undefined;
		}
	}
}
