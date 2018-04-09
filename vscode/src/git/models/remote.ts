'use strict';

export enum GitRemoteType {
    Fetch = 'fetch',
    Push = 'push'
}

export class GitRemote {

    constructor(
        public readonly repoPath: string,
        public readonly name: string,
        public readonly url: string,
        public readonly domain: string,
        public readonly path: string,
        public readonly types: { type: GitRemoteType, url: string }[]
    ) { }
}