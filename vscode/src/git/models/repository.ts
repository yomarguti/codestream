'use strict';
import { Uri } from 'vscode';
import { GitRemote } from '../gitService';
import { Container } from '../../container';

export class GitRepository {
    constructor(
        public readonly uri: Uri
    ) { }

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
}
