"use strict";
import {
	ChannelServiceType,
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
	CSStream,
	StreamType
} from "../../agent/agentConnection";
import { Container } from "../../container";
import { Iterables, Strings } from "../../system";
import { CodeStreamSession, StreamsChangedEvent } from "../session";
import { CodeStreamCollection, CodeStreamItem } from "./collection";
import { Post, PostCollection } from "./posts";
import { Repository } from "./repositories";
import { User } from "./users";

export { StreamType } from "../../agent/agentConnection";

abstract class StreamBase<T extends CSStream> extends CodeStreamItem<T> {
	constructor(session: CodeStreamSession, stream: T) {
		super(session, stream);
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

	async post(text: string, parentPostId?: string) {
		const post = (await Container.agent.posts.create(this.entity.id, text, undefined, parentPostId))
			.post;
		if (post === undefined) throw new Error(`Unable to post to Stream(${this.entity.id})`);

		return new Post(this.session, post);
	}
}

export class ChannelStream extends StreamBase<CSChannelStream> {
	readonly type = StreamType.Channel;

	constructor(session: CodeStreamSession, stream: CSChannelStream) {
		super(session, stream);
	}

	get name() {
		return this.entity.name;
	}

	// @memoize
	// async label() {
	// 	return `#${this.entity.name}`;
	// }

	get memberIds(): string[] | undefined {
		return this.entity.memberIds;
	}

	memberOf(id: string) {
		return this.entity.memberIds === undefined ? true : this.entity.memberIds.includes(id);
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

	// @memoize
	// async label() {
	// 	const label = Iterables.join(
	// 		Iterables.map(await this.members(this.session.userId), u => u.name),
	// 		", "
	// 	);
	// 	if (!label && this.entity.memberIds.includes(this.session.userId)) {
	// 		return `${this.session.user.name} (you)`;
	// 	}

	// 	return label;
	// }

	get memberIds(): string[] {
		return this.entity.memberIds;
	}

	memberOf(id: string) {
		return this.entity.memberIds.includes(id);
	}

	async members(...excludes: string[]): Promise<Iterable<User>> {
		return this.session.users.filter(
			u => !excludes.includes(u.id) && this.entity.memberIds.includes(u.id)
		);
	}
}

export class FileStream extends StreamBase<CSFileStream> {
	readonly type = StreamType.File;

	constructor(session: CodeStreamSession, stream: CSFileStream) {
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

	// label() {
	// 	return this.entity.file;
	// }
}

export type Stream = ChannelStream | DirectStream;

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

		this.disposables.push(session.onDidChangeStreams(this.onStreamsChanged, this));
	}

	protected onStreamsChanged(e: StreamsChangedEvent) {
		this.invalidate();
	}
}

export interface ChannelStreamCreationOptions {
	membership?: "auto" | string[];
	privacy?: "public" | "private";
	purpose?: string;
}

export interface ServiceChannelStreamCreationOptions {
	name?: string;
	membership?: "auto" | string[];
	privacy?: "public" | "private";
	purpose?: string;
	serviceInfo?: { [key: string]: any };
}

export class ChannelStreamCollection extends StreamCollectionBase<ChannelStream, CSChannelStream> {
	constructor(session: CodeStreamSession, teamId: string) {
		super(session, teamId);
	}

	async getByName(name: string): Promise<ChannelStream | undefined> {
		return Iterables.find(await this.items(), s => s.name === name);
	}

	async getByService(type: ChannelServiceType, key: string): Promise<ChannelStream | undefined> {
		return Iterables.find(
			await this.items(),
			s => s.entity.serviceType === type && s.entity.serviceKey === key
		);
	}

	async getDefaultTeamChannel(): Promise<ChannelStream> {
		const entities = (await this.entities()).sort((a, b) => a.createdAt - b.createdAt);
		const stream = entities.find(s => s.isTeamStream && !s.isArchived);
		if (stream === undefined) throw new Error(`Unable to find a default stream`);

		return new ChannelStream(this.session, stream);
	}

	async getOrCreateByService(
		type: ChannelServiceType,
		key: string,
		creationOptions: ServiceChannelStreamCreationOptions = {}
	) {
		const stream = await this.getByService(type, key);
		if (stream !== undefined) {
			if (
				stream.entity.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(
					id => !stream.entity.memberIds!.includes(id)
				);

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this.session, entity);
			}

			return stream;
		}

		const s = (await Container.agent.streams.createChannel(
			creationOptions.name!,
			creationOptions.membership,
			creationOptions.privacy,
			creationOptions.purpose,
			{
				serviceType: type,
				serviceKey: key,
				serviceInfo: creationOptions.serviceInfo
			}
		)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new ChannelStream(this.session, s);
	}

	async getOrCreateByName(
		name: string,
		creationOptions: ChannelStreamCreationOptions = {}
	): Promise<ChannelStream> {
		const stream = await this.getByName(name);
		if (stream !== undefined) {
			if (
				stream.entity.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(
					id => !stream.entity.memberIds!.includes(id)
				);

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this.session, entity);
			}

			return stream;
		}

		const s = (await Container.agent.streams.createChannel(
			name,
			creationOptions.membership,
			creationOptions.privacy,
			creationOptions.purpose
		)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new ChannelStream(this.session, s);
	}

	protected entityMapper(e: CSChannelStream) {
		return new ChannelStream(this.session, e);
	}

	protected async fetch() {
		return (await Container.agent.streams.fetch([StreamType.Channel])).streams as CSChannelStream[];
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

		const s = (await Container.agent.streams.createDirect(memberIds)).stream;
		if (s === undefined) throw new Error(`Unable to create stream`);

		return new DirectStream(this.session, s);
	}

	protected entityMapper(e: CSDirectStream) {
		return new DirectStream(this.session, e);
	}

	protected async fetch() {
		return (await Container.agent.streams.fetch([StreamType.Direct])).streams as CSDirectStream[];
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
		return (await Container.agent.streams.fetch([StreamType.Channel, StreamType.Direct]))
			.streams as CSChannelStream[];
	}
}

export class FileStreamCollection extends StreamCollectionBase<FileStream, CSFileStream> {
	constructor(session: CodeStreamSession, teamId: string, public readonly repo: Repository) {
		super(session, teamId);
	}

	protected onStreamsChanged(e: StreamsChangedEvent) {
		this.invalidate();
	}

	protected entityMapper(e: CSFileStream) {
		return new FileStream(this.session, e);
	}

	protected async fetch() {
		return (await Container.agent.streams.fetchFiles(this.repo.id)).streams;
	}
}
