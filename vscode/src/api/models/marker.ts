"use strict";
import { Range } from "vscode";
import { CSFullMarker, CSLocationArray, CSMarker } from "../../agent/agentConnection";
import { Container } from "../../container";
import { memoize } from "../../system";
import { CodeStreamSession, Post } from "../session";

export class Marker {
	private readonly _range: Range;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _entity: CSFullMarker,
		location: CSLocationArray
	) {
		this._range = new Range(location[0], location[1], location[2], location[3]);
	}

	@memoize
	get hoverRange() {
		return new Range(this._range.start.line, 0, this._range.start.line, 0);
	}

	get id() {
		return this._entity.id;
	}

	@memoize
	get entity(): CSMarker {
		const { codemark: _, range: __, ...marker } = this._entity;
		return marker;
	}

	private _post: Post | undefined;
	async post() {
		if (this._post === undefined) {
			const post = (await Container.agent.posts.get(
				this._entity.codemark.streamId,
				this._entity.codemark.postId
			)).post;
			this._post = new Post(this.session, post);
		}
		return this._post;
	}

	get postId() {
		return this._entity.postId;
	}

	get postStreamId() {
		return this._entity.postStreamId;
	}

	get range() {
		return this._range;
	}

	get color(): string {
		return this._entity.codemark.color || "blue";
	}

	get type(): string {
		return this._entity.codemark.type || "comment";
	}

	get status(): string {
		return this._entity.codemark.status || "open";
	}

	get summary() {
		return this._entity.codemark.title ? this._entity.codemark.title : this._entity.codemark.text;
	}
}
