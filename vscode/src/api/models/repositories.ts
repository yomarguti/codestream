'use strict';
import { Uri, Disposable } from 'vscode';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { CodeStreamStreams } from './streams';
import { Repository } from '../types';
import { Iterables } from '../../system';
import { Git } from '../../git/git';

export class CodeStreamRepository extends CodeStreamItem<Repository> {

    constructor(
        session: CodeStreamSession,
        repo: Repository
    ) {
        super(session, repo);
    }

    // private _reposByUrl: Map<string, Repository> = new Map();
    // @signedIn
    // async getRepositories() {
    //     return this._reposByUrl.values();
    // }

    // @signedIn
    // async getMarkersForUri(uri: Uri): Promise<MarkerLocations | undefined> {
    //     const sha = await Git.getCurrentSha(uri);
    //     return undefined;
    //     // return this._api.getMarkerLocations(sha, stream);
    // }

    private _streams: CodeStreamStreams | undefined;
    get streams() {
        if (this._streams === undefined) {
            this._streams = new CodeStreamStreams(this.session, this);
        }
        return this._streams;
    }

    get teamId() {
        return this.entity.teamId;
    }

    get url() {
        return this.entity.normalizedUrl;
    }

    is(uri: Uri): boolean {
        const file = uri.fsPath;
        return true;
    }
}

export class CodeStreamRepositories extends CodeStreamCollection<CodeStreamRepository, Repository> {

    constructor(session: CodeStreamSession) {
        super(session);

        this._disposable = Disposable.from(
            session.onDidChange(this.onSessionChanged, this)
        );
    }

    private onSessionChanged() {
        this.invalidate();
    }

    // async getMarkersForUri(uri: Uri): Promise<MarkerLocations | undefined> {
    //     const sha = await Git.getCurrentSha(uri);
    //     return undefined;
    //     // return this._api.getMarkerLocations(sha, stream);
    // }

    async getRepositoryForUri(uri: Uri): Promise<CodeStreamRepository | undefined> {
        return Iterables.find(await this.items, r => r.is(uri));
    }

    private _reposByUri: Map<Uri, CodeStreamRepository> = new Map();

    protected async getEntities() {
        const repos = await this.session.getRepos();

        const items = [];
        try {
            const gitRepos = await Git.getRepositories();

            this._reposByUri.clear();

            let firsts;
            let remoteUrl: string | undefined;
            for (const gr of gitRepos) {
                [firsts, remoteUrl] = await Promise.all([
                    Git.getFirstCommits(gr),
                    Git.getNormalizedRemoteUrl(gr)
                ]);

                if (remoteUrl === undefined || firsts.length === 0) continue;

                const repo = repos.find(r => r.normalizedUrl === remoteUrl);
                if (repo === undefined) continue;

                const item = this.mapEntity(repo);
                this._reposByUri.set(gr.rootUri, item);
                items.push(item);
            }
        }
        catch (ex) {
            debugger;
        }

        return items;
    }

    protected mapper(e: Repository) {
        return new CodeStreamRepository(this.session, e);
    }
}
