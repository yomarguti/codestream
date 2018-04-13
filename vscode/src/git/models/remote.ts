import { Uri } from 'vscode';

'use strict';

export enum GitRemoteType {
    Fetch = 'fetch',
    Push = 'push'
}

export class GitRemote {

    public readonly uri: Uri;

    constructor(
        public readonly repoPath: string,
        public readonly name: string,
        url: string,
        public readonly domain: string,
        public readonly path: string,
        public readonly types: { type: GitRemoteType, url: string }[]
    ) {
        this.uri = Uri.parse(url);
    }

    get normalizedUrl(): string {
        return `${this.domain}/${this.path}`;
    }
}