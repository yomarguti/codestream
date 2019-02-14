"use strict";
import { Range, Uri } from "vscode";
import { CSFullPost } from "../../agent/agentConnection";
import { Container } from "../../container";
import { Dates, memoize } from "../../system";
import { CodeStreamSession } from "../session";
import { CodeStreamItem } from "./item";
import { Stream } from "./stream";
import { User } from "./user";

interface CodeBlock {
	readonly code: string;
	readonly range: Range;
	readonly revision?: string;
	readonly uri: Uri;
}

export class Post extends CodeStreamItem<CSFullPost> {
	constructor(session: CodeStreamSession, post: CSFullPost, private _stream?: Stream) {
		super(session, post);
	}

	@memoize
	get date() {
		return new Date(this.entity.createdAt);
	}

	get deleted() {
		return !!this.entity.deactivated;
	}

	get edited() {
		return !!this.entity.hasBeenEdited;
	}

	get codemark() {
		return this.entity.codemark;
	}

	get hasCode() {
		return (
			this.entity.codemark && this.entity.codemark.markers && this.entity.codemark.markers.length
		);
	}

	get hasReactions() {
		return this.entity.reactions != null;
	}

	get hasReplies() {
		return this.entity.numReplies > 0;
	}

	get senderId() {
		return this.entity.creatorId;
	}

	get streamId() {
		return this.entity.streamId;
	}

	get teamId() {
		return this.entity.teamId;
	}

	get text() {
		return this.entity.text;
	}

	get threadId() {
		return this.entity.parentPostId || this.id;
	}

	private _dateFormatter?: Dates.IDateFormatter;

	formatDate(format?: string | null) {
		if (format == null) {
			format = "MMMM Do, YYYY h:mma";
		}

		if (this._dateFormatter === undefined) {
			this._dateFormatter = Dates.toFormatter(this.date);
		}
		return this._dateFormatter.format(format);
	}

	fromNow() {
		if (this._dateFormatter === undefined) {
			this._dateFormatter = Dates.toFormatter(this.date);
		}
		return this._dateFormatter.fromNow();
	}

	mentioned(userId: string): boolean {
		return this.entity.mentionedUserIds == null || this.entity.mentionedUserIds.length === 0
			? false
			: this.entity.mentionedUserIds.includes(userId);
	}

	@memoize
	async sender(): Promise<User | undefined> {
		// TODO: Bake this into the post model to avoid this lookup??
		const response = await Container.agent.users.get(this.entity.creatorId);
		if (response.user === undefined) return undefined;

		return new User(this.session, response.user);
	}

	@memoize
	stream(): Promise<Stream> {
		return this.getStream(this.entity.streamId);
	}

	private async getStream(streamId: string): Promise<Stream> {
		if (this._stream === undefined) {
			this._stream = await this.session.getStream(streamId);
			if (this._stream === undefined) throw new Error(`Stream(${streamId}) could not be found`);
		}
		return this._stream;
	}
}
