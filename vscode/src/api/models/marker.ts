"use strict";
import { Range } from "vscode";
import { CSLocationArray, CSMarker } from "../../agent/agentConnection";
import { Container } from "../../container";
import { memoize } from "../../system";
import { CodeStreamSession, Post } from "../session";

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
			const post = (await Container.agent.posts.get(this.entity.streamId, this.entity.postId)).post;
			this._post = new Post(this.session, post);
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
}
