"use strict";
import { Range } from "vscode";
import { Container } from "../../container";
import { memoize } from "../../system/decorators";
import { CSLocationArray, CSMarker } from "../api";
import { ChannelStream, CodeStreamSession, DirectStream, Post } from "../session";

export class Marker {
	private readonly _range: Range;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly entity: CSMarker,
		location: CSLocationArray
	) {
		this._range = new Range(location[0], location[1], location[2], location[3]);
	}

	@memoize
	get hoverRange() {
		return new Range(this._range.start.line, 0, this._range.start.line, 0);
	}

	get id() {
		return this.entity.id;
	}

	private _post: Post | undefined;
	async post() {
		if (this._post === undefined) {
			const stream = await this.stream();
			if (stream === undefined) {
				const post = (await Container.agent.posts.get(this.entity.streamId, this.entity.postId))
					.post;
				this._post = new Post(this.session, post);
			} else {
				this._post = await stream.posts.get(this.entity.postId);
			}
		}
		return this._post;
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
			this._stream = await this.session.channelsAndDMs.get(this.entity.streamId);
		}
		return this._stream;
	}
}

// export class MarkerCollection {
// 	constructor(
// 		public readonly session: CodeStreamSession,
// 		public readonly repository: Repository,
// 		public readonly fileStream: FileStream,
// 		private readonly _uri: Uri,
// 		public readonly teamId: string
// 	) {}

// 	async filter(predicate: (item: Marker) => boolean) {
// 		return Iterables.filter(await this.items(), predicate);
// 	}

// 	async find(predicate: (item: Marker) => boolean) {
// 		return Iterables.find(await this.items(), predicate);
// 	}

// 	async first() {
// 		return Iterables.first(await this.items());
// 	}

// 	async get(key: string) {
// 		const collection = await this.ensureLoaded();
// 		return collection.get(key);
// 	}

// 	async has(key: string) {
// 		const collection = await this.ensureLoaded();
// 		return collection.has(key);
// 	}

// 	private _collection: Promise<Map<string, Marker>> | undefined;
// 	async items(): Promise<IterableIterator<Marker>> {
// 		const items = await this.ensureLoaded();
// 		return items.values();
// 	}

// 	protected ensureLoaded() {
// 		if (this._collection === undefined) {
// 			this._collection = this.load();
// 		}
// 		return this._collection;
// 	}

// 	protected async load() {
// 		try {
// 			const resp = await Container.agent.getLatestRevision(this._uri);
// 			const revision = resp.revision!;
// 			const markers = new Map<string, CSMarker>(
// 				(await this.session.api.getMarkers(revision, this.fileStream.id)).map<[string, CSMarker]>(
// 					m => [m.id, m]
// 				)
// 			);
// 			const markerLocations = await this.session.api.getMarkerLocations(
// 				revision,
// 				this.fileStream.id
// 			);

// 			const entities = new Map<string, Marker>();

// 			if (markers.size === 0 || !markerLocations.locations) return entities;

// 			for (const id of Object.keys(markerLocations.locations)) {
// 				const marker = markers.get(id);
// 				if (marker === undefined) continue;

// 				entities.set(
// 					id,
// 					new Marker(
// 						this.session,
// 						marker,
// 						markerLocations.commitHash,
// 						markerLocations.locations[id]
// 					)
// 				);
// 			}

// 			return entities;
// 		} catch (ex) {
// 			Logger.error(ex);
// 			debugger;
// 			throw ex;
// 		}
// 	}
// }
