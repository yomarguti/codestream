"use strict";
import Uri from "vscode-uri";
import { GitRemote, IGitService } from "../gitService";

export class GitRepository {
	constructor(public readonly uri: Uri, private readonly _git: IGitService) {}

	private _commits: string[] | undefined;
	async getFirstCommits() {
		if (this._commits === undefined) {
			this._commits = await this._git.getRepoFirstCommits(this.uri);
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
			this._remote = await this._git.getRepoRemote(this.uri);
		}
		return this._remote;
	}
}
