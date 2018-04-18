'use strict';
import { Range, Uri } from 'vscode';
import { CodeStreamCollection, CodeStreamItem } from './collection';
import { CodeStreamSession, PostsReceivedEvent } from '../session';
import { ChannelStream, DirectStream, FileStream, Stream, StreamType } from '../models/streams';
import { Repository } from '../models/repositories';
import { User } from '../models/users';
import { CSPost } from '../types';
import { memoize } from '../../system';

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

    @memoize
    get codeBlock(): Promise<CodeBlock | undefined> {
        return this.getCodeBlock();
    }

    get hasCode() {
        return this.entity.codeBlocks !== undefined && this.entity.codeBlocks.length !== 0;
    }

    @memoize
    get repo(): Promise<Repository | undefined> {
        return this.getRepo();
    }

    @memoize
    get sender(): Promise<User | undefined> {
        return this.session.users.get(this.entity.creatorId);
    }

    get senderId() {
        return this.entity.creatorId;
    }

    @memoize
    get stream(): Promise<Stream>  {
        return this.getStream(this.entity.streamId);
    }

    get teamId() {
        return this.entity.teamId;
    }

    get text() {
        return this.entity.text;
    }

    private async getCodeBlock(): Promise<CodeBlock | undefined> {
        if (this.entity.codeBlocks === undefined || this.entity.codeBlocks.length === 0) return undefined;

        const block = this.entity.codeBlocks[0];

        const marker = await this.session.api.getMarker(block.markerId);
        if (marker === undefined) throw new Error(`Unable to find code block for Post(${this.entity.id})`);

        // TODO: Assuming the marker has the same repoId as the post -- probably not a great assumption
        const markerStream = await this.getStream(marker.streamId);
        if (markerStream.type !== 'file') throw new Error(`Unable to find code block for Post(${this.entity.id})`);
        const uri = await markerStream.absoluteUri;

        const locations = await this.session.api.getMarkerLocations(this.entity.commitHashWhenPosted!, this.entity.streamId);
        if (locations === undefined) throw new Error(`Unable to find code block for Post(${this.entity.id})`);

        const location = locations.locations[block.markerId];

        return {
            code: block.code,
            range: new Range(location[0], location[1], location[2], location[3]),
            hash: this.entity.commitHashWhenPosted!,
            uri: uri!
        };
    }

    private async getRepo() {
        const stream = await this.stream;
        if (stream.type !== StreamType.File) return undefined;

        return stream.repo;
    }

    private async getStream(streamId: string): Promise<Stream> {
        if (this._stream === undefined) {
            const stream = await this.session.api.getStream(streamId);
            if (stream === undefined) throw new Error(`Stream(${streamId}) could not be found`);

            switch (stream.type) {
                case 'channel':
                    this._stream = new ChannelStream(this.session, stream!);
                    break;
                case 'direct':
                    this._stream = new DirectStream(this.session, stream!);
                    break;
                case 'file':
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
