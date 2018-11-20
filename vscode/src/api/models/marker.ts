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
		private readonly entity: CSFullMarker,
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
			const post = (await Container.agent.posts.get(
				this.entity.codemark.streamId,
				this.entity.codemark.postId
			)).post;
			this._post = new Post(this.session, post);
		}
		return this._post;
	}

	get postId() {
		return this.entity.postId;
	}

	get postStreamId() {
		return this.entity.postStreamId;
	}

	get range() {
		return this._range;
	}

	get color(): string {
		return this.entity.codemark.color || "blue";
	}

	get type(): string {
		return this.entity.codemark.type || "comment";
	}

	get status(): string {
		return this.entity.codemark.status || "open";
	}

	get summary() {
		return this.entity.codemark.title ? this.entity.codemark.title : this.entity.codemark.text;
	}
}
