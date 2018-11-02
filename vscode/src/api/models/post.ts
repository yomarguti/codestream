"use strict";
import { Range, Uri } from "vscode";
import { CSPost } from "../../agent/agentConnection";
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

export class Post extends CodeStreamItem<CSPost> {
	constructor(session: CodeStreamSession, post: CSPost, private _stream?: Stream) {
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

	get hasCode() {
		return this.entity.codeBlocks !== undefined && this.entity.codeBlocks.length !== 0;
	}

	get hasReactions() {
		return this.entity.reactions != null;
	}

	get hasReplies() {
		return !!this.entity.hasReplies;
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

	// @memoize
	async codeBlock(): Promise<CodeBlock | undefined> {
		if (this.entity.codeBlocks === undefined || this.entity.codeBlocks.length === 0) {
			return undefined;
		}

		const block = this.entity.codeBlocks[0];
		const resp = await Container.agent.getDocumentFromCodeBlock(block);
		if (resp === undefined || resp === null) return undefined;

		return {
			code: block.code,
			range: new Range(
				resp.range.start.line,
				resp.range.start.character,
				resp.range.end.line,
				resp.range.end.character
			),
			revision: resp.revision,
			uri: Uri.parse(resp.textDocument.uri)
		};
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
