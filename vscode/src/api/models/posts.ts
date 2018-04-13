'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession, PostsReceivedEvent, Stream } from '../session';
import { CSPost } from '../types';

export class Post extends CodeStreamItem<CSPost> {

    constructor(
        session: CodeStreamSession,
        post: CSPost
    ) {
        super(session, post);
    }

    get repoId() {
        return this.entity.repoId;
    }

    get senderId() {
        return this.entity.creatorId;
    }

    get teamId() {
        return this.entity.teamId;
    }

    get text() {
        return this.entity.text;
    }

    // async getRepo() {
    //     const repo = await this.session.repos.get(this.entity.repoId);
    //     if (repo === undefined) throw new Error(`Repository(${this.entity.repoId}) could not be found`);

    //     return repo;
    // }
}

export class PostCollection extends CodeStreamCollection<Post, CSPost> {

    constructor(
        session: CodeStreamSession,
        public readonly stream: Stream
    ) {
        super(session);

        this.disposables.push(
            session.onDidReceivePosts(this.onPostsReceived, this)
        );
    }

    private onPostsReceived(e: PostsReceivedEvent) {
        if (e.affects('stream', this.stream.id)) {
            this.invalidate();
        }
    }

    protected async fetch() {
        return this.session.api.getPosts(this.stream.id);
}

    protected map(e: CSPost) {
        return new Post(this.session, e);
    }
}
