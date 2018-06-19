"use strict";
import {
	Disposable,
	Event,
	EventEmitter,
	Uri,
	workspace,
	WorkspaceFoldersChangeEvent
} from "vscode";
import { GitAuthorParser } from "./parsers/authorParser";
import { git, GitApiRepository, GitErrors, GitWarnings } from "./git";
import { Logger } from "../logger";
import { GitAuthor, GitRemote, GitRepository } from "./models/models";
import { GitRemoteParser } from "./parsers/remoteParser";
import { Strings } from "../system";
import * as fs from "fs";
import * as path from "path";
import { Container } from "../container";

export * from "./models/models";

export interface IGitService extends Disposable {
	onDidChangeRepositories: Event<void>;

	getFileAuthors(
		uri: Uri,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	getFileAuthors(
		path: string,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	// getFileAuthors(uriOrPath: Uri | string, options?: { ref?: string, contents?: string, startLine?: number, endLine?: number }): Promise<GitAuthor[]>;

	getFileCurrentSha(uri: Uri): Promise<string | undefined>;
	getFileCurrentSha(path: string): Promise<string | undefined>;
	// getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined>;

	getFileRevision(uri: Uri, ref: string): Promise<string | undefined>;
	getFileRevision(path: string, ref: string): Promise<string | undefined>;
	// getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined>;

	getFileRevisionContent(uri: Uri, ref: string): Promise<string | undefined>;
	getFileRevisionContent(path: string, ref: string): Promise<string | undefined>;
	// getFileRevisionContent(uriOrPath: Uri | string, ref: string): Promise<string | undefined>;

	getRepoFirstCommits(repoUri: Uri): Promise<string[]>;
	getRepoFirstCommits(repoPath: string): Promise<string[]>;
	// getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]>;

	getRepoRemote(repoUri: Uri): Promise<GitRemote | undefined>;
	getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
	// getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined>;

	getRepositories(): Promise<GitRepository[]>;

	resolveRef(uri: Uri, ref: string): Promise<string | undefined>;
	resolveRef(path: string, ref: string): Promise<string | undefined>;
	//   resolveRef(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
}

export class GitService extends Disposable implements IGitService {
	private readonly _disposable: Disposable;

	private _onDidChangeRepositories = new EventEmitter<void>();
	get onDidChangeRepositories(): Event<void> {
		return this._onDidChangeRepositories.event;
	}

	constructor() {
		super(() => this.dispose());

		this._disposable = workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private onWorkspaceFoldersChanged(e: WorkspaceFoldersChangeEvent) {
		this._repositories = undefined;
		this._onDidChangeRepositories.fire();
	}

	async getFileAuthors(
		uri: Uri,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	async getFileAuthors(
		path: string,
		options?: { ref?: string; contents?: string; startLine?: number; endLine?: number }
	): Promise<GitAuthor[]>;
	async getFileAuthors(
		uriOrPath: Uri | string,
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

	async getFileCurrentSha(uri: Uri): Promise<string | undefined>;
	async getFileCurrentSha(path: string): Promise<string | undefined>;
	async getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined> {
		const [dir, filename] = Strings.splitPath(
			typeof uriOrPath === "string" ? uriOrPath : uriOrPath.fsPath
		);

		const data = (await git({ cwd: dir }, "log", "-n1", "--format=%H", "--", filename)).trim();
		return data ? data : undefined;
	}

	async getFileRevision(uri: Uri, ref: string): Promise<string | undefined>;
	async getFileRevision(path: string, ref: string): Promise<string | undefined>;
	async getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
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

		const tmp = await import("tmp");
		return new Promise<string>((resolve, reject) => {
			tmp.file(
				{ prefix: `${path.basename(filename, ext)}-${suffix}__`, postfix: ext },
				(err, destination, fd, cleanupCallback) => {
					if (err) {
						reject(err);
						return;
					}

					Logger.log(`getFileRevision[${destination}]('${dir}', '${filename}', ${ref})`);
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

	async getFileRevisionContent(uri: Uri, ref: string): Promise<string | undefined>;
	async getFileRevisionContent(path: string, ref: string): Promise<string | undefined>;
	async getFileRevisionContent(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
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

	async getRepoFirstCommits(repoUri: Uri): Promise<string[]>;
	async getRepoFirstCommits(repoPath: string): Promise<string[]>;
	async getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]> {
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

	async getRepoRemote(repoUri: Uri): Promise<GitRemote | undefined>;
	async getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
	async getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined> {
		const repoPath = typeof repoUriOrPath === "string" ? repoUriOrPath : repoUriOrPath.fsPath;

		let data;
		try {
			data = await git({ cwd: repoPath }, "remote", "-v");
			if (!data) return undefined;
		} catch {
			return undefined;
		}

		const remotes = GitRemoteParser.parse(data, repoPath);
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

	protected _repositories: GitRepository[] | undefined;
	async getRepositories(): Promise<GitRepository[]> {
		if (this._repositories === undefined) {
			const repos = await Container.agent.sendRequest<GitApiRepository[]>("codeStream/git/repos");
			// const repos = await getRepositories();
			this._repositories = repos.map(r => new GitRepository(Uri.parse(r.rootUri as string)));
		}
		return this._repositories;
	}

	async resolveRef(uri: Uri, ref: string): Promise<string | undefined>;
	async resolveRef(path: string, ref: string): Promise<string | undefined>;
	async resolveRef(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
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
