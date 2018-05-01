'use strict';
import { Range, Uri } from 'vscode';
import { Container } from '../../container';
import { ChannelStream, CodeStreamSession, DirectStream, FileStream, Repository } from '../session';
import { Iterables } from '../../system';
import { CSMarker } from '../types';

export class Marker {

    private readonly _range: Range;

    constructor(
        public readonly session: CodeStreamSession,
        public readonly fileStream: FileStream,
        private readonly entity: CSMarker,
        private readonly _commitHash: string,
        location: [number, number, number, number]
    ) {
        this._range = new Range(location[0], location[1], location[2], location[3]);
    }

    get commitHash() {
        return this._commitHash;
    }

    get id() {
        return this.entity.id;
    }

    async post() {
        const stream = await this.stream();
        if (stream === undefined) return undefined;

        return stream.posts.get(this.entity.postId);
    }

    get postId() {
        return this.entity.postId;
    }

    get postStreamId() {
        return this.entity.streamId;
    }

    get range() {
        return this._range;
    }

    private _stream: ChannelStream | DirectStream | undefined;
    async stream() {
        if (this._stream === undefined) {
            this._stream = await this.session.channels.get(this.entity.streamId);
            if (this._stream === undefined) {
                this._stream = await this.session.directMessages.get(this.entity.streamId);
            }
        }
        return this._stream;
    }
}

export class MarkerCollection {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly repository: Repository,
        public readonly fileStream: FileStream,
        private readonly _uri: Uri,
        public readonly teamId: string
    ) {
    }

    async filter(predicate: (item: Marker) => boolean) {
        return Iterables.filter(await this.items(), predicate);
    }

    async find(predicate: (item: Marker) => boolean) {
        return Iterables.find(await this.items(), predicate);
    }

    async first() {
        return Iterables.first(await this.items());
    }

    async get(key: string) {
        const collection = await this.ensureLoaded();
        return collection.get(key);
    }

    async has(key: string) {
        const collection = await this.ensureLoaded();
        return collection.has(key);
    }

    private _collection: Promise<Map<string, Marker>> | undefined;
    async items(): Promise<IterableIterator<Marker>> {
        const items = await this.ensureLoaded();
        return items.values();
    }

    protected ensureLoaded() {
        if (this._collection === undefined) {
            this._collection = this.load();
        }
        return this._collection;
    }

    protected async load() {
        const sha = await Container.git.getFileCurrentSha(this._uri);
        const markers = new Map<string, CSMarker>((await this.session.api.getMarkers(sha!, this.fileStream.id)).map<[string, CSMarker]>(m => [m.id, m]));
        const markerLocations = await this.session.api.getMarkerLocations(sha!, this.fileStream.id);

        const entities = new Map<string, Marker>();

        for (const id of Object.keys(markerLocations.locations)) {
            const marker = markers.get(id);
            if (marker === undefined) continue;

            entities.set(id, new Marker(this.session, this.fileStream, marker, markerLocations.commitHash, markerLocations.locations[id]));
        }

        return entities;
    }
}
