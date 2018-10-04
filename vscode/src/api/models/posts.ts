"use strict";
import { Range, Uri } from "vscode";
import { CSPost } from "../../agent/agentConnection";
import { Container } from "../../container";
import { Dates, memoize } from "../../system";
import { CodeStreamSession, PostsChangedEvent } from "../session";
import { CodeStreamCollection, CodeStreamItem } from "./collection";
import { Stream } from "./streams";
import { User } from "./users";

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
	sender(): Promise<User | undefined> {
		return this.session.users.get(this.entity.creatorId);
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

export class PostCollection extends CodeStreamCollection<Post, CSPost> {
	constructor(
		session: CodeStreamSession,
		public readonly teamId: string,
		public readonly stream: Stream
	) {
		super(session);

		this.disposables.push(session.onDidChangePosts(this.onPostsChanged, this));
	}

	private onPostsChanged(e: PostsChangedEvent) {
		if (e.affects(this.stream.id, "stream")) {
			this.invalidate();
		}
	}

	async mostRecent() {
		const collection = await this.ensureLoaded();
		if (collection.size === 0) return undefined;

		const posts = [...collection.values()];
		posts.sort(
			(a, b) =>
				(this.isItem(a) ? a.date.getTime() : a.createdAt) -
				(this.isItem(b) ? b.date.getTime() : b.createdAt)
		);

		const post = posts[posts.length - 1];
		return this.ensureItem(collection, post.id, post);
	}

	protected entityMapper(e: CSPost) {
		return new Post(this.session, e, this.stream);
	}

	protected async fetch() {
		return (await Container.agent.posts.fetch(this.stream.id)).posts;
	}
}
