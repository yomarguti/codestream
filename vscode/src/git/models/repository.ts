"use strict";
import * as fs from "fs";
import * as Path from "path";
import { Uri } from "vscode";
import { Container } from "../../container";
import { GitRemote } from "../gitService";

export class GitRepository {
	constructor(public readonly uri: Uri) {}

	private _commits: string[] | undefined;
	async getFirstCommits() {
		if (this._commits === undefined) {
			this._commits = await Container.git.getRepoFirstCommits(this.uri);
		}
		return this._commits;
	}

	async getNormalizedUrl(): Promise<string | undefined> {
		const remote = await this.getRemote();
		if (remote === undefined) return undefined;

		return remote.normalizedUrl;
	}

	private _remote: GitRemote | undefined;
	async getRemote() {
		if (this._remote === undefined) {
			this._remote = await Container.git.getRepoRemote(this.uri);
		}
		return this._remote;
	}

	containsFile(path: string) {
		return fs.existsSync(Path.join(this.uri.fsPath, path));
	}
}
