'use strict';
import { Uri } from 'vscode';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { Iterables } from '../../system';
import { CodeStreamSession } from '../session';
import { Post, PostCollection } from './posts';
import { Repository } from './repositories';
import { CSStream } from '../types';

export class Stream extends CodeStreamItem<CSStream> {

    constructor(
        session: CodeStreamSession,
        stream: CSStream
    ) {
        super(session, stream);
    }

    get repoId() {
        return this.entity.repoId;
    }

    get teamId() {
        return this.entity.teamId;
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

    async post(text: string) {
        const post = await this.session.api.createPost(text, this.entity.id, this.entity.teamId);
        if (post === undefined) throw new Error(`Unable to post to Stream(${this.entity.id})`);

        return new Post(this.session, post);
    }

    async getRepo() {
        const repo = await this.session.repos.get(this.entity.repoId);
        if (repo === undefined) throw new Error(`Repository(${this.entity.repoId}) could not be found`);

        return repo;
    }
}

export class StreamCollection extends CodeStreamCollection<Stream, CSStream> {

    constructor(
        session: CodeStreamSession,
        public readonly repo?: Repository
    ) {
        super(session);
    }

    async getByUri(uri: Uri): Promise<Stream | undefined> {
        if (this.repo === undefined) throw new Error(`File streams only exist at the repository level`);

        const path = uri.fsPath;
        return Iterables.find(await this.items, s => s.path === path);
    }

    protected async fetch() {
        if (this.repo !== undefined) return this.session.api.getStreams(this.repo.id);

        // HACK: If we have no repo "parent" then pretend we are "team-level", but for now hack it as the first repo
        const repos = await this.session.repos.items;
        const repo = Iterables.first(repos);
        return Array.from(await repo.streams.items);
}

    protected map(e: CSStream) {
        return new Stream(this.session, e);
    }
}
