'use strict';
import { Range, Uri } from 'vscode';
import { CodeStreamCollection, CodeStreamItem } from './collection';
import { CodeStreamSession, PostsReceivedEvent } from '../session';
import { ChannelStream, DirectStream, FileStream, Stream, StreamType } from '../models/streams';
import { Repository } from '../models/repositories';
import { User } from '../models/users';
import { CSPost } from '../types';
import { Iterables, memoize } from '../../system';

interface CodeBlock {
    readonly code: string;
    readonly hash: string;
    readonly range: Range;
    readonly uri: Uri;
}

export class Post extends CodeStreamItem<CSPost> {

    constructor(
        session: CodeStreamSession,
        post: CSPost,
        private _stream?: Stream
    ) {
        super(session, post);
    }

    get hasCode() {
        return this.entity.codeBlocks !== undefined && this.entity.codeBlocks.length !== 0;
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

    @memoize
    async codeBlock(): Promise<CodeBlock | undefined> {
        if (this.entity.codeBlocks === undefined || this.entity.codeBlocks.length === 0) return undefined;

        const block = this.entity.codeBlocks[0];

        const repo = await this.session.repos.get(block.repoId);
        if (repo === undefined) throw new Error(`Unable to find code block for Post(${this.entity.id})`);

        const uri = repo.normalizeUri(block.file);

        const markerStream = await repo.streams.getByUri(uri);
        if (markerStream === undefined) throw new Error(`Unable to find code block for Post(${this.entity.id})`);

        const locations = await this.session.api.getMarkerLocations(this.entity.commitHashWhenPosted!, markerStream.id);
        if (locations === undefined) throw new Error(`Unable to find code block for Post(${this.entity.id})`);

        const location = locations.locations[block.markerId];

        return {
            code: block.code,
            range: new Range(location[0], location[1], location[2], location[3]),
            hash: this.entity.commitHashWhenPosted!,
            uri: uri!
        };
    }

    mentioned(name: string): boolean {
        name = name.toLocaleUpperCase();
        return Iterables.some(this.mentions(), m => m.toLocaleUpperCase() === name);
    }

    // async *mentionedUsers() {
    //     for (const mention of this.mentions()) {
    //         const user = await this.session.users.getByName(mention);
    //         if (user !== undefined) yield user;
    //     }
    // }

    *mentions() {
        // Recreate this each call, because this iterable can be stopped and never finished
        // and the regex can end up trying to continue incorrectly
        const mentionsRegex = /(?:^|\s)@(\w+)(?:\b(?!@|[\(\{\[\<\-])|$)/g;

        let match: RegExpExecArray | null = null;
        do {
            match = mentionsRegex.exec(this.entity.text);
            if (match == null) break;

            const [, mention] = match;
            yield mention;
        } while (match != null);
    }

    @memoize
    async repo(): Promise<Repository | undefined> {
        const stream = await this.stream();
        if (stream.type !== StreamType.File) return undefined;

        return stream.repo();
    }

    @memoize
    sender(): Promise<User | undefined> {
        return this.session.users.get(this.entity.creatorId);
    }

    @memoize
    stream(): Promise<Stream>  {
        return this.getStream(this.entity.streamId);
    }

    private async getStream(streamId: string): Promise<Stream> {
        if (this._stream === undefined) {
            const stream = await this.session.api.getStream(streamId);
            if (stream === undefined) throw new Error(`Stream(${streamId}) could not be found`);

            switch (stream.type) {
                case StreamType.Channel:
                    this._stream = new ChannelStream(this.session, stream!);
                    break;
                case StreamType.Direct:
                    this._stream = new DirectStream(this.session, stream!);
                    break;
                case StreamType.File:
                    this._stream = new FileStream(this.session, stream!);
                    break;
                default:
                  throw new Error('Invalid stream type');
            }
        }
        return this._stream;
    }
}

export class PostCollection extends CodeStreamCollection<Post, CSPost> {

    constructor(
        session: CodeStreamSession,
        public readonly teamId: string,
        public readonly stream: Stream
    ) {
        super(session);

        this.disposables.push(
            session.onDidReceivePosts(this.onPostsReceived, this)
        );
    }

    private onPostsReceived(e: PostsReceivedEvent) {
        if (e.affects(this.stream.id)) {
            this.invalidate();
        }
    }

    protected async fetch() {
        return this.session.api.getPosts(this.stream.id);
    }

    protected fetchMapper(e: CSPost) {
        return new Post(this.session, e, this.stream);
    }
}
