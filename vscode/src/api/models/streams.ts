"use strict";
import { Uri } from "vscode";
import { Iterables, memoize, Strings } from "../../system";
import { CSChannelStream, CSDirectStream, CSFileStream, CSStream, StreamType } from "../api";
import { CodeStreamSession, SessionChangedEvent, SessionChangedType } from "../session";
import { CodeStreamCollection, CodeStreamItem } from "./collection";
import { Post, PostCollection } from "./posts";
import { Repository } from "./repositories";
import { Team } from "./teams";
import { User } from "./users";

export { StreamType } from "../api";

abstract class StreamBase<T extends CSStream> extends CodeStreamItem<T> {
	constructor(session: CodeStreamSession, stream: T) {
		super(session, stream);
	}

	get hidden() {
		return false;
	}

	private _posts: PostCollection | undefined;
	get posts() {
		if (this._posts === undefined) {
			this._posts = new PostCollection(this.session, this.entity.teamId, this as any);
		}
		return this._posts;
	}

	get teamId() {
		return this.entity.teamId;
	}

	hide() {}

	async post(text: string, parentPostId?: string) {
		const post = await this.session.api.createPost(
			text,
			parentPostId,
			this.entity.id,
			this.entity.teamId
		);
		if (post === undefined) throw new Error(`Unable to post to Stream(${this.entity.id})`);

		return new Post(this.session, post);
	}

	async postCode(
		text: string,
		code: string,
		range: [number, number, number, number],
		commitHash: string,
		markerStream: FileStream,
		parentPostId?: string
	): Promise<Post>;
	async postCode(
		text: string,
		code: string,
		range: [number, number, number, number],
		commitHash: string,
		markerStream: string | { file: string; repoId: string },
		parentPostId?: string
	): Promise<Post>;
	async postCode(
		text: string,
		code: string,
		range: [number, number, number, number],
		commitHash: string,
		markerStreamOrId: FileStream | string | { file: string; repoId: string },
		parentPostId?: string
	) {
		const markerStream =
			markerStreamOrId instanceof FileStream ? markerStreamOrId.id : markerStreamOrId;

		const post = await this.session.api.createPostWithCode(
			text,
			parentPostId,
			code,
			range,
			commitHash,
			markerStream,
			this.entity.id,
			this.entity.teamId
		);
		if (post === undefined) throw new Error(`Unable to post code to Stream(${this.entity.id})`);

		return new Post(this.session, post);
	}

	// @memoize
	async team(): Promise<Team> {
		const team = await this.session.teams.get(this.entity.teamId);
		if (team === undefined) throw new Error(`Team(${this.entity.teamId}) could not be found`);

		return team;
	}

	async markRead(): Promise<any> {
		return this.session.api.markStreamRead(this.id);
	}
}

// TODO: Using this format, because channel names can only be 64 characters
const liveShareServiceChannelRegex = /^ls:(.*?):(.*)$/;

export class ChannelStream extends StreamBase<CSChannelStream> {
	readonly type = StreamType.Channel;

	constructor(session: CodeStreamSession, stream: CSChannelStream) {
		super(session, stream);
	}

	get name() {
		return this.entity.name;
	}

	@memoize
	get isLiveShareChannel() {
		return liveShareServiceChannelRegex.test(this.entity.name);
	}

	async label() {
		// ls:<userId>:<sessionId>
		const match = liveShareServiceChannelRegex.exec(this.entity.name);
		if (match == null) return `#${this.entity.name}`;

		const [, userId] = match;

		let members = "";
		if (this.entity.memberIds !== undefined) {
			members = ` (${Iterables.join(
				Iterables.map((await this.members(userId))!, u => u.name),
				", "
			)})`;
		}

		const user = await this.session.users.get(userId);
		return `${user !== undefined ? `${user.name}'s ` : ""}Session${members}`;
	}

	async members(...excludes: string[]): Promise<Iterable<User> | undefined> {
		if (this.entity.memberIds === undefined) return undefined;

		return this.session.users.filter(
			u => !excludes.includes(u.id) && this.entity.memberIds!.includes(u.id)
		);
	}
}

export class DirectStream extends StreamBase<CSDirectStream> {
	readonly type = StreamType.Direct;

	constructor(session: CodeStreamSession, stream: CSDirectStream) {
		super(session, stream);
	}

	@memoize
	async label() {
		const label = Iterables.join(
			Iterables.map(await this.members(this.session.userId), u => u.name),
			", "
		);
		if (!label && this.entity.memberIds.includes(this.session.userId)) {
			return `${this.session.user.name} (you)`;
		}

		return label;
	}

	get memberIds(): string[] {
		return this.entity.memberIds;
	}

	async members(...excludes: string[]): Promise<Iterable<User>> {
		return this.session.users.filter(
			u => !excludes.includes(u.id) && this.entity.memberIds.includes(u.id)
		);
	}
}

export class FileStream extends StreamBase<CSFileStream> {
	readonly type = StreamType.File;

	constructor(session: CodeStreamSession, stream: CSFileStream, private _repo?: Repository) {
		super(session, stream);
	}

	get name() {
		return Strings.normalizePath(this.entity.file);
	}

	get path() {
		return this.entity.file;
	}

	get repoId() {
		return this.entity.repoId;
	}

	// @memoize
	// get uri() {
	//     const uri = Uri.parse(this.entity.file);
	//     if (uri.scheme) return uri;

	//     return Uri.file(this.entity.file);
	// }

	@memoize
	async absoluteUri() {
		const repo = await this.repo();
		if (repo === undefined) return undefined;

		const uri = Uri.parse(this.path);
		if (uri.scheme) return uri;

		return repo.normalizeUri(Uri.file(this.path));
	}

	label() {
		return this.entity.file;
	}

	// @memoize
	async repo(): Promise<Repository> {
		if (this._repo === undefined) {
			const repo = await this.session.repos.get(this.entity.repoId);
			if (repo === undefined) {
				throw new Error(`Repository(${this.entity.repoId}) could not be found`);
			}

			this._repo = repo;
		}

		return this._repo;
	}
}

export type Stream = ChannelStream | DirectStream | FileStream;

export interface StreamThread {
	id: string | undefined;
	stream: Stream;
}

abstract class StreamCollectionBase<
	TItem extends StreamBase<TEnitity>,
	TEnitity extends CSStream
> extends CodeStreamCollection<TItem, TEnitity> {
	constructor(session: CodeStreamSession, public readonly teamId: string) {
		super(session);

		this.disposables.push(session.onDidChange(this.onSessionChanged, this));
	}

	protected onSessionChanged(e: SessionChangedEvent) {
		if (e.type !== SessionChangedType.Streams) return;

		if (e.affects(this.teamId, "team")) {
			this.invalidate();
		}
	}
}

export interface ChannelStreamCreationOptions {
	membership?: "auto" | string[];
	privacy?: "public" | "private";
}

export class ChannelStreamCollection extends StreamCollectionBase<ChannelStream, CSChannelStream> {
	constructor(session: CodeStreamSession, teamId: string) {
		super(session, teamId);
	}

	async getByName(name: string): Promise<ChannelStream | undefined> {
		return Iterables.find(await this.items(), s => s.name === name);
	}

	async getOrCreateByName(
		name: string,
		creationOptions: ChannelStreamCreationOptions = {}
	): Promise<ChannelStream> {
		const stream = await this.getByName(name);
		if (stream !== undefined) return stream;

		const s = await this.session.api.createChannelStream(
			name,
			creationOptions.membership,
			creationOptions.privacy,
			this.teamId
		);
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new ChannelStream(this.session, s);
	}

	protected entityMapper(e: CSChannelStream) {
		return new ChannelStream(this.session, e);
	}

	protected async fetch() {
		return this.session.api.getChannelStreams();
	}
}

export class DirectStreamCollection extends StreamCollectionBase<DirectStream, CSDirectStream> {
	constructor(session: CodeStreamSession, teamId: string) {
		super(session, teamId);
	}

	async getByMembers(memberIds: string[]): Promise<DirectStream | undefined> {
		const sortedMembers = memberIds.sort();
		return Iterables.find(await this.items(), s => {
			return s.memberIds.sort().every((value, index) => {
				return value === sortedMembers[index];
			});
		});
	}

	async getOrCreateByMembers(memberIds: string[]): Promise<DirectStream> {
		const stream = await this.getByMembers(memberIds);
		if (stream !== undefined) return stream;

		const s = await this.session.api.createDirectStream(memberIds, this.teamId);
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new DirectStream(this.session, s);
	}

	protected entityMapper(e: CSDirectStream) {
		return new DirectStream(this.session, e);
	}

	protected async fetch() {
		return this.session.api.getDirectStreams();
	}
}

export class ChannelAndDirectStreamCollection extends StreamCollectionBase<
	ChannelStream | DirectStream,
	CSChannelStream | CSDirectStream
> {
	constructor(session: CodeStreamSession, teamId: string) {
		super(session, teamId);
	}

	protected entityMapper(e: CSChannelStream | CSDirectStream) {
		if (e.type === StreamType.Direct) return new DirectStream(this.session, e);

		return new ChannelStream(this.session, e);
	}

	protected async fetch() {
		return this.session.api.getChannelOrDirectStreams();
	}
}

export class FileStreamCollection extends StreamCollectionBase<FileStream, CSFileStream> {
	constructor(session: CodeStreamSession, teamId: string, public readonly repo: Repository) {
		super(session, teamId);
	}

	protected onSessionChanged(e: SessionChangedEvent) {
		if (e.type !== SessionChangedType.Streams) return;

		if (e.affects(this.teamId, "team") && e.affects(this.repo.id)) {
			this.invalidate();
		}
	}

	async getByUri(uri: Uri): Promise<FileStream | undefined> {
		if (uri.scheme !== "file" && uri.scheme !== "vsls") throw new Error(`Uri must be a file`);

		const relativePath = this.repo.relativizeUri(uri);

		return Iterables.find(await this.items(), s => s.path === relativePath);
	}

	async getOrCreateByUri(uri: Uri): Promise<FileStream> {
		const stream = await this.getByUri(uri);
		if (stream !== undefined) return stream;

		const relativePath = this.repo.relativizeUri(uri);

		const s = await this.session.api.createFileStream(relativePath, this.repo.id);
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new FileStream(this.session, s, this.repo);
	}

	async toIdOrArgs(uri: Uri) {
		const markerStream = await this.repo.streams.getByUri(uri);
		return markerStream !== undefined
			? markerStream.id
			: {
					file: this.repo.relativizeUri(uri),
					repoId: this.repo.id
			  };
	}

	protected entityMapper(e: CSFileStream) {
		return new FileStream(this.session, e, this.repo);
	}

	protected async fetch() {
		return this.session.api.getFileStreams(this.repo.id);
	}
}
