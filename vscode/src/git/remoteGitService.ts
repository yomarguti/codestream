'use strict';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IGitService } from './gitService';
import { GitAuthor, GitRemote, GitRemoteType, GitRepository } from './models/models';

export * from './models/models';

export interface RemoteRepository {
    id: string;
    hash: string;
    normalizedUrl: string;
    url: string;
}

export class RemoteGitService extends Disposable implements IGitService {

    private _onDidChangeRepositories = new EventEmitter<void>();
    get onDidChangeRepositories(): Event<void> {
        return this._onDidChangeRepositories.event;
    }

    constructor(private _repos: RemoteRepository[]) {
        super(() => this.dispose());
    }

    dispose() {
    }

    async getFileAuthors(uriOrPath: Uri | string, options: { ref?: string, contents?: string, startLine?: number, endLine?: number } = {}): Promise<GitAuthor[]> {
        return [];
    }

    async getFileCurrentSha(uriOrPath: Uri | string): Promise<string | undefined> {
        return undefined;
    }

    async getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
        return undefined;
    }

    async getFileRevisionContent(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
        return undefined;
    }

    async getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]> {
        // const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        const repo = this._repos[0]; // .find(r => r.url === repoPath))
        return [repo.hash];
    }

    async getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined> {
        const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        const repo = this._repos[0]; // .find(r => r.url === repoPath))
        const uri = Uri.parse(repo.url);

        let urlPath = uri.path[0] === '/' ? uri.path.substr(1) : uri.path;
        if (urlPath.endsWith('.git')) {
            urlPath = urlPath.substr(0, urlPath.length - 4);
        }
        return new GitRemote(repoPath, repo.normalizedUrl, repo.url, uri.scheme, uri.authority, urlPath, [{ type: GitRemoteType.Push, url: repo.url }]);
    }

    protected _repositories: GitRepository[] | undefined;
    async getRepositories(): Promise<GitRepository[]> {
        if (this._repositories === undefined) {
            this._repositories = this._repos.map(r => new GitRepository(Uri.parse(r.url).with({ scheme: 'vsls' })));
        }
        return this._repositories;
    }

    async resolveRef(uri: Uri, ref: string): Promise<string | undefined>;
    async resolveRef(path: string, ref: string): Promise<string | undefined>;
    async resolveRef(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
        return ref;
    }
}
