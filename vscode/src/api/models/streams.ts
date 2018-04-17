'use strict';
import { Range, Uri } from 'vscode';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { Iterables } from '../../system';
import { CodeStreamSession, SessionChangedEvent, SessionChangedType } from '../session';
import { Post, PostCollection } from './posts';
import { Repository } from './repositories';
import { CSStream } from '../types';

export class Stream extends CodeStreamItem<CSStream> {

    constructor(
        session: CodeStreamSession,
        stream: CSStream,
        private _repo?: Repository
    ) {
        super(session, stream);
    }

    get path() {
        return this.entity.file;
    }

    private _posts: PostCollection | undefined;
    get posts() {
        if (this._posts === undefined) {
            this._posts = new PostCollection(this.session, this);
        }
        return this._posts;
    }

    get repo(): Promise<Repository | undefined> {
        return this.getRepo();
    }

    // get teamId() {
    //     return this.entity.teamId;
    // }

    get uri() {
        return Uri.file(this.entity.file);
    }

    get absoluteUri() {
        return this.getAbsoluteUri();
    }

    private async getAbsoluteUri() {
        const repo = await this.repo;
        if (repo === undefined) return undefined;

        return repo.normalizeUri(this.uri);
    }

    async post(text: string) {
        const post = await this.session.api.createPost(text, this.entity.id, this.entity.teamId);
        if (post === undefined) throw new Error(`Unable to post to Stream(${this.entity.id})`);

        return new Post(this.session, post);
    }

    async postCode(text: string, code: string, range: Range, commitHash: string) {
        const post = await this.session.api.createPostWithCode(text, code, range, commitHash, this.entity.id, this.entity.teamId);
        if (post === undefined) throw new Error(`Unable to post code to Stream(${this.entity.id})`);

        return new Post(this.session, post);
    }

    private async getRepo() {
        if (this._repo === undefined && this.entity.repoId !== undefined) {
            const repo = await this.session.repos.get(this.entity.repoId);
            if (repo === undefined) throw new Error(`Repository(${this.entity.repoId}) could not be found`);

            this._repo = repo;
        }

        return this._repo;
    }
}

export class StreamCollection extends CodeStreamCollection<Stream, CSStream> {

    constructor(
        session: CodeStreamSession,
        public readonly repo?: Repository
    ) {
        super(session);

        this.disposables.push(
            session.onDidChange(this.onSessionChanged, this)
        );
    }

    private onSessionChanged(e: SessionChangedEvent) {
        if (e.type !== SessionChangedType.Streams) return;

        if (this.repo === undefined || e.affects(this.repo.id)) {
            this.invalidate();
        }
    }

    async getByUri(uri: Uri): Promise<Stream | undefined> {
        if (this.repo === undefined) throw new Error(`File streams only exist at the repository level`);

        const path = this.repo.relativizeUri(uri).fsPath;
        return Iterables.find(await this.items, s => s.path === path);
    }

    protected async fetch() {
        if (this.repo !== undefined) return this.session.api.getStreams(this.repo.id);

        // HACK: If we have no repo "parent" then pretend we are "team-level", but for now hack it as the first repo
        const repos = await this.session.repos.items;
        const repo = Iterables.first(repos);
        return [...await repo.streams.items];
}

    protected map(e: CSStream) {
        return new Stream(this.session, e, this.repo);
    }
}
