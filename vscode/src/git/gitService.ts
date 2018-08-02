"use strict";
import * as fs from "fs";
import * as path from "path";
import { Uri } from "vscode";
import { Container } from "../container";
import { Logger } from "../logger";
import { Strings } from "../system";
import { git, GitWarnings } from "./git";
import { GitRemote, GitRepository } from "./models/models";
import { GitRemoteParser } from "./parsers/remoteParser";

export * from "./models/models";

export interface IGitService {
	getFileCurrentSha(uri: Uri): Promise<string | undefined>;
	getFileCurrentSha(path: string): Promise<string | undefined>;
	// getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined>;

	getFileRevision(uri: Uri, ref: string): Promise<string | undefined>;
	getFileRevision(path: string, ref: string): Promise<string | undefined>;
	// getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined>;

	getRepoFirstCommits(repoUri: Uri): Promise<string[]>;
	getRepoFirstCommits(repoPath: string): Promise<string[]>;
	// getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]>;

	getRepoRemote(repoUri: Uri): Promise<GitRemote | undefined>;
	getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
	// getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined>;

	getRepositories(): Promise<GitRepository[]>;
}

export class GitService implements IGitService {
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
			this._repositories = await Container.agent.getRepositories();
			// const repos = await getRepositories();
		}
		return this._repositories;
	}
}
