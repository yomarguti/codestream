"use strict";
import * as path from "path";
import { Range } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { MessageType } from "../api/apiProvider";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreateCodemarkRequest,
	CreateCodemarkRequestMarker,
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequest,
	CreatePostWithMarkerRequestType,
	CSFullCodemark,
	CSFullPost,
	DeletePostRequest,
	DeletePostRequestType,
	DeletePostResponse,
	EditPostRequest,
	EditPostRequestType,
	EditPostResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesRequestType,
	FetchPostRepliesResponse,
	FetchPostsRequest,
	FetchPostsRequestType,
	FetchPostsResponse,
	GetPostRequest,
	GetPostRequestType,
	GetPostResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadRequestType,
	MarkPostUnreadResponse,
	PreparePostWithCodeRequest,
	PreparePostWithCodeRequestType,
	PreparePostWithCodeResponse,
	ReactToPostRequest,
	ReactToPostRequestType,
	ReactToPostResponse
} from "../shared/agent.protocol";
import {
	CodemarkType,
	CSMarkerLocation,
	CSPost,
	CSStream,
	StreamType
} from "../shared/api.protocol";
import { Arrays, debug, Iterables, lsp, lspHandler, Strings } from "../system";
import { BaseIndex, IndexParams, IndexType } from "./cache";
import { getValues, KeyValue } from "./cache/baseCache";
import { EntityCache, EntityCacheCfg } from "./cache/entityCache";
import { EntityManagerBase, Id } from "./entityManager";

export type FetchPostsFn = (request: FetchPostsRequest) => Promise<FetchPostsResponse>;

interface SearchResult {
	index?: number;
	afterIndex?: number;
	outOfRange?: boolean;
}

function search(posts: CSPost[], seq: string | number): SearchResult {
	if (posts.length === 0) {
		return {
			outOfRange: true
		};
	}

	const seqNum = Number(seq);
	let min = 0;
	let max = posts.length - 1;
	let guess: number;

	const minSeqNum = Number(posts[min].seqNum);
	const maxSeqNum = Number(posts[max].seqNum);

	if (seqNum < minSeqNum || seqNum > maxSeqNum) {
		return {
			outOfRange: true
		};
	}

	while (min <= max) {
		guess = Math.floor((min + max) / 2);
		const guessPost = posts[guess];
		if (guessPost.seqNum === seq) {
			return {
				index: guess
			};
		} else {
			const guessSeqNum = Number(guessPost.seqNum);

			if (min === max) {
				if (seqNum > guessSeqNum) {
					return {
						afterIndex: min
					};
				} else {
					return {
						afterIndex: min - 1
					};
				}
			}

			if (guessSeqNum < seqNum) {
				min = guess + 1;
			} else {
				max = guess - 1;
			}
		}
	}

	throw new Error("Unexpected error on PostIndex.search()");
}

class PostCollection {
	private posts: CSPost[];

	constructor(request: FetchPostsRequest, response: FetchPostsResponse) {
		this.posts = response.posts;
		this.updateComplete(request, response);
	}

	private complete = false;
	private updateComplete(request: FetchPostsRequest, response: FetchPostsResponse) {
		if (this.complete) {
			return;
		}

		if (request.after === undefined && !response.more) {
			this.complete = true;
		}
	}

	getBetween(
		after: string | number,
		before: string | number,
		inclusive?: boolean
	): { posts?: CSPost[] } {
		let { index: start } = search(this.posts, after);
		if (start === undefined) {
			return {};
		}

		let { index: end } = search(this.posts, before);
		if (end === undefined) {
			return {};
		}

		if (inclusive) {
			end++;
		} else {
			start++;
		}

		return {
			posts: this.posts.slice(start, end)
		};
	}

	getBefore(
		before: string | number,
		limit: number,
		inclusive?: boolean
	): { posts?: CSPost[]; more?: boolean } {
		let { index: end } = search(this.posts, before);
		if (end === undefined) {
			return {};
		}

		if (inclusive) {
			end++;
		}

		const start = end - limit;
		if (start < 0 && this.complete) {
			return {
				posts: this.posts.slice(0, end),
				more: false
			};
		} else if (start < 0) {
			return {};
		} else {
			return {
				posts: this.posts.slice(start, end),
				more: true
			};
		}
	}

	getAfter(
		after: string | number,
		limit: number,
		inclusive?: boolean
	): { posts?: CSPost[]; more?: boolean } {
		let { index: start } = search(this.posts, after);
		if (start === undefined) {
			return {};
		}

		if (!inclusive) {
			start++;
		}

		const end = start + limit;
		return {
			posts: this.posts.slice(start, end),
			more: end <= this.posts.length
		};
	}

	getLatest(limit: number): { posts: CSPost[]; more: boolean } {
		let start = this.posts.length - limit;
		const more = start > 0 || !this.complete;
		start = Math.max(0, start);

		return {
			posts: this.posts.slice(start),
			more
		};
	}

	get latest() {
		return this.posts[this.posts.length - 1];
	}

	updateOrInsert(post: CSPost) {
		const seqNum = Number(post.seqNum);
		const latestSeqNum = this.latest ? Number(this.latest.seqNum) : 0;
		if (seqNum > latestSeqNum) {
			this.posts.push(post);
		} else {
			const { outOfRange, index, afterIndex } = search(this.posts, post.seqNum);
			if (outOfRange) {
				return;
			} else if (index !== undefined) {
				this.posts[index] = post;
			} else if (afterIndex !== undefined) {
				this.posts.splice(afterIndex + 1, 0, post);
			}
		}
	}

	push(post: CSPost) {
		this.posts.push(post);
	}

	add(request: FetchPostsRequest, response: FetchPostsResponse) {
		const { before, after } = request;
		const { posts } = response;

		if (after) {
			return;
		}

		const firstNewSeq = posts[0].seqNum;
		const lastNewSeq = posts[posts.length - 1].seqNum;
		const firstExistingSeq = this.posts[0].seqNum;

		const firstNewSeqNum = Number(firstNewSeq);
		const lastNewSeqNum = Number(lastNewSeq);
		const firstExistingSeqNum = Number(firstExistingSeq);

		if (before === firstExistingSeq && lastNewSeqNum < firstExistingSeqNum) {
			this.posts = posts.concat(this.posts);
		} else if (firstNewSeqNum < firstExistingSeqNum) {
			const { index } = search(this.posts, lastNewSeq);
			if (index !== undefined) {
				this.posts = posts.concat(this.posts.slice(index + 1));
			}
		}

		this.updateComplete(request, response);
	}
}

export class PostIndex extends BaseIndex<CSPost> {
	private readonly postsByStream = new Map<Id, PostCollection>();

	constructor(fetchFn: FetchPostsFn) {
		super(["streamId"], fetchFn as any);
	}

	invalidate(): void {
		this.postsByStream.clear();
	}

	isStreamInitialized(streamId: Id): boolean {
		return this.postsByStream.has(streamId);
	}

	getPosts(request: FetchPostsRequest): { posts?: CSPost[]; more?: boolean } {
		const { streamId, after, before, limit = 100, inclusive } = request;
		const postCollection = this.postsByStream.get(streamId);
		if (!postCollection) {
			return {};
		}

		if (after !== undefined && before !== undefined) {
			return postCollection.getBetween(after, before, inclusive);
		} else if (after !== undefined) {
			return postCollection.getAfter(after, limit, inclusive);
		} else if (before !== undefined) {
			return postCollection.getBefore(before, limit, inclusive);
		} else {
			return postCollection.getLatest(limit);
		}
	}

	setPosts(request: FetchPostsRequest, response: FetchPostsResponse) {
		const { streamId } = request;
		let postCollection = this.postsByStream.get(streamId);
		if (!postCollection) {
			postCollection = new PostCollection(request, response);
			this.postsByStream.set(streamId, postCollection);
		} else {
			postCollection.add(request, response);
		}
	}

	set(entity: CSPost, oldEntity?: CSPost): void {
		const streamId = entity.streamId;
		const posts = this.postsByStream.get(streamId);
		if (!posts) {
			return;
		}

		posts.updateOrInsert(entity);
	}
}

interface PostCacheCfg extends EntityCacheCfg<CSPost> {
	fetchPosts: FetchPostsFn;
}

class PostsCache extends EntityCache<CSPost> {
	private readonly postIndex: PostIndex;
	private readonly fetchPosts: FetchPostsFn;

	constructor(cfg: PostCacheCfg) {
		super(cfg);
		this.fetchPosts = cfg.fetchPosts;
		this.postIndex = new PostIndex(cfg.fetchPosts);
		this.indexes.set("streamId", this.postIndex);
	}

	@debug({
		exit: (result: FetchPostsResponse) =>
			`returned ${result.posts.length} posts (more=${result.more})`,
		prefix: (context, request: FetchPostsRequest) => `${context.prefix}(${request.streamId})`,
		singleLine: true
	})
	async getPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const cc = Logger.getCorrelationContext();

		let { posts, more } = this.postIndex.getPosts(request);
		if (posts === undefined) {
			Logger.debug(cc, `cache miss, fetching...`);
			const response = await this.fetchPosts(request);

			this.set(response.posts);

			this.postIndex.setPosts(request, response);
			posts = response.posts;
			more = response.more;
		}

		return { posts: posts!, more };
	}

	private _streamInitialization = new Map<Id, Promise<void>>();
	async ensureStreamInitialized(streamId: Id): Promise<void> {
		if (this.postIndex.isStreamInitialized(streamId)) {
			return;
		}

		const promise = this._streamInitialization.get(streamId);
		if (promise) {
			await promise;
		} else {
			Logger.debug(`PostCache: initializing stream ${streamId}`);
			const newPromise = this.getPosts({
				streamId: streamId,
				limit: 100
			});
			this._streamInitialization.set(streamId, newPromise as Promise<any>);
			await newPromise;
		}
	}
}

function trackPostCreation(request: CreatePostRequest) {
	process.nextTick(() => {
		try {
			// Get stream so we can determine type
			Container.instance()
				.streams.getById(request.streamId)
				.then((stream: CSStream) => {
					let streamType: String = "Unknown";
					switch (stream.type) {
						case StreamType.Channel:
							stream.privacy === "private"
								? (streamType = "Private Channel")
								: (streamType = "Public Channel");
							break;
						case StreamType.Direct:
							streamType = "Direct Message";
							break;
					}

					let markerType = "Chat";
					const telemetry = Container.instance().telemetry;
					let isMarker = false;
					// Check if it's a marker
					if (request.codemark != null) {
						isMarker = true;
					}

					// Get Type for codemark
					if (request.codemark != null) {
						// TODO: Add Bookmark and Issue
						switch (request.codemark.type) {
							case CodemarkType.Question:
								markerType = "Question";
								break;
							case CodemarkType.Comment:
								markerType = "Comment";
								break;
							case CodemarkType.Trap:
								markerType = "Trap";
								break;
							case CodemarkType.Bookmark:
								markerType = "Bookmark";
								break;
							case CodemarkType.Issue:
								markerType = "Issue";
								break;
						}
					}

					const payload: {
						[key: string]: any;
					} = {
						"Stream Type": streamType,
						Type: markerType,
						Thread: request.parentPostId ? "Reply" : "Parent",
						Marker: isMarker
					};
					// TODO: Add Category
					if (!Container.instance().session.telemetryData.hasCreatedPost) {
						payload["First Post?"] = new Date().toISOString();
						Container.instance().session.telemetryData.hasCreatedPost = true;
					}
					telemetry.track({ eventName: "Post Created", properties: payload });
				})
				.catch(ex => Logger.error(ex));
		} catch (ex) {
			Logger.error(ex);
		}
	});
}

@lsp
export class PostsManager extends EntityManagerBase<CSPost> {
	protected readonly cache: PostsCache = new PostsCache({
		idxFields: this.getIndexedFields(),
		fetchFn: this.fetch.bind(this),
		fetchPosts: this.fetchPosts.bind(this),
		entityName: this.getEntityName()
	});

	async cacheSet(entity: CSPost, oldEntity?: CSPost): Promise<CSPost | undefined> {
		if (entity && entity.streamId) {
			await this.cache.ensureStreamInitialized(entity.streamId);
		}

		return super.cacheSet(entity, oldEntity);
	}

	getIndexedFields(): IndexParams<CSPost>[] {
		return [
			{
				fields: ["streamId", "parentPostId"],
				type: IndexType.Group,
				fetchFn: this.fetchByParentPostId.bind(this)
			}
		];
	}

	protected async fetchById(id: Id): Promise<CSPost> {
		const response = await this.session.api.getPost({ streamId: undefined!, postId: id });
		return response.post;
	}

	private async fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const response = await this.session.api.fetchPosts(request);
		const container = Container.instance();
		if (response.codemarks) {
			for (const codemark of response.codemarks) {
				container.codemarks.cacheSet(codemark);
			}
		}
		if (response.markers) {
			for (const marker of response.markers) {
				container.markers.cacheSet(marker);
			}
		}
		return response;
	}

	private async fetchByParentPostId(criteria: KeyValue<CSPost>[]): Promise<CSPost[]> {
		const [streamId, parentPostId] = getValues(criteria);
		const response = await this.session.api.fetchPostReplies({
			streamId,
			postId: parentPostId
		});
		return response.posts;
	}

	@lspHandler(FetchPostsRequestType)
	async get(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		await this.cache.ensureStreamInitialized(request.streamId);
		const cacheResponse = await this.cache.getPosts(request);
		const fullPosts = await this.fullPosts(cacheResponse.posts);
		const { codemarks } = await Container.instance().codemarks.get({ streamId: request.streamId });
		return {
			posts: fullPosts,
			more: cacheResponse.more,
			codemarks
		};
	}

	async fullPosts(csPosts: CSPost[]): Promise<CSFullPost[]> {
		const fullPosts = [];
		for (const csPost of csPosts) {
			fullPosts.push(await this.fullPost(csPost));
		}
		return fullPosts;
	}

	private async fullCodemarks(codemarkIds: string[]): Promise<CSFullCodemark[]> {
		const fullCodemarks = [];
		for (const codemarkId of codemarkIds) {
			let fullCodemark: CSFullCodemark;
			const codemark = await Container.instance().codemarks.getById(codemarkId);
			fullCodemark = {
				...codemark
			};
			if (codemark.markerIds) {
				fullCodemark.markers = [];
				for (const markerId of codemark.markerIds) {
					fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
				}
			}
			fullCodemarks.push(fullCodemark);
		}

		return fullCodemarks;
	}

	private async fullPost(csPost: CSPost): Promise<CSFullPost> {
		if (csPost.codemarkId) {
			try {
				const csCodemark = await Container.instance().codemarks.getById(csPost.codemarkId);
				const fullCodemark: CSFullCodemark = {
					...csCodemark
				};
				let hasMarkers = false;
				if (csCodemark.markerIds) {
					fullCodemark.markers = [];
					for (const markerId of csCodemark.markerIds) {
						fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
						hasMarkers = true;
					}
				}
				return {
					...csPost,
					codemark: fullCodemark,
					hasMarkers
				};
			} catch (err) {
				Logger.error(err);
			}
		}

		return {
			...csPost,
			hasMarkers: false
		};
	}

	@lspHandler(FetchPostRepliesRequestType)
	async getReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		let parentPost;
		let childPosts;

		try {
			parentPost = await this.cache.getById(request.postId);
		} catch (err) {
			Logger.error(err, `Could not find thread's parent post ${request.postId}`);
		}

		try {
			childPosts = await this.cache.getGroup([
				["streamId", request.streamId],
				["parentPostId", request.postId]
			]);
		} catch (err) {
			Logger.error(err, `Could not find thread ${request.postId}`);
		}

		const posts = [];
		if (parentPost) {
			posts.push(parentPost);
		}
		if (childPosts) {
			posts.push(...childPosts);
		}

		const codemarks: CSFullCodemark[] = await this.fullCodemarks(
			Arrays.filterMap(posts, post => post.codemarkId)
		);

		return { posts, codemarks };
	}

	@lspHandler(CreatePostRequestType)
	async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
		const response = await this.session.api.createPost(request);
		trackPostCreation(request);
		await resolveCreatePostResponse(response);
		return {
			...response,
			post: await this.fullPost(response.post)
		};
	}

	@lspHandler(CreatePostWithMarkerRequestType)
	async createPostWithMarker({
		textDocument: documentId,
		rangeArray,
		text,
		code,
		source,
		streamId,
		parentPostId,
		mentionedUserIds,
		title,
		type,
		assignees,
		color,
		externalProvider,
		externalAssignees,
		externalProviderUrl,
		status = "open"
	}: CreatePostWithMarkerRequest): Promise<CreatePostResponse | undefined> {
		const { git } = Container.instance();
		const filePath = URI.parse(documentId.uri).fsPath;
		const fileContents = this.lastFullCode;

		const codemarkRequest = {
			title,
			text,
			type,
			assignees,
			color,
			status: type === CodemarkType.Issue ? status : undefined,
			externalProvider,
			externalAssignees:
				externalAssignees && externalAssignees.map(a => ({ displayName: a.displayName })),
			externalProviderUrl
		} as CreateCodemarkRequest;
		let marker: CreateCodemarkRequestMarker | undefined;
		let commitHashWhenPosted: string | undefined;
		let location: CSMarkerLocation | undefined;
		let backtrackedLocation: CSMarkerLocation | undefined;
		let remotes: string[] | undefined;
		if (rangeArray) {
			const range = Range.create(rangeArray[0], rangeArray[1], rangeArray[2], rangeArray[3]);
			location = Container.instance().markerLocations.rangeToLocation(range);

			if (source) {
				if (source.revision) {
					commitHashWhenPosted = source.revision;
					backtrackedLocation = await Container.instance().markerLocations.backtrackLocation(
						documentId,
						fileContents,
						location
					);
				} else {
					commitHashWhenPosted = (await git.getRepoHeadRevision(source.repoPath))!;
					backtrackedLocation = Container.instance().markerLocations.emptyFileLocation();
				}
				if (source.remotes && source.remotes.length > 0) {
					remotes = source.remotes.map(r => r.url);
				}
			}

			marker = {
				code,
				remotes,
				file: source && source.file,
				commitHash: commitHashWhenPosted,
				location:
					backtrackedLocation &&
					Container.instance().markerLocations.locationToArray(backtrackedLocation)
			};

			codemarkRequest.streamId = streamId;
			codemarkRequest.markers = marker && [marker];
			codemarkRequest.remotes = remotes;
		}

		try {
			const response = await this.createPost({
				streamId,
				text: "",
				parentPostId,
				codemark: codemarkRequest,
				mentionedUserIds
			});

			const { markers } = response;
			if (markers && markers.length && backtrackedLocation) {
				const meta = backtrackedLocation.meta;
				if (meta && (meta.startWasDeleted || meta.endWasDeleted)) {
					const uncommittedLocation = {
						...location!,
						id: markers[0].id
					};

					await Container.instance().markerLocations.saveUncommittedLocation(
						filePath,
						fileContents,
						uncommittedLocation
					);
				}
			}

			response.codemark!.markers = response.markers;
			return response;
		} catch (ex) {
			debugger;
			return;
		}
	}

	private lastFullCode = "";
	@lspHandler(PreparePostWithCodeRequestType)
	async documentPreparePost({
		textDocument: documentId,
		range,
		dirty
	}: PreparePostWithCodeRequest): Promise<PreparePostWithCodeResponse> {
		const { documents, git } = Container.instance();

		const document = documents.get(documentId.uri);
		if (document === undefined) {
			throw new Error(`No document could be found for Uri(${documentId.uri})`);
		}
		this.lastFullCode = document.getText();

		const uri = URI.parse(document.uri);

		let authors: { id: string; username: string }[] | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;

		let gitError;
		let repoPath;
		if (uri.scheme === "file") {
			try {
				repoPath = await git.getRepoRoot(uri.fsPath);
				if (repoPath !== undefined) {
					file = Strings.normalizePath(path.relative(repoPath, uri.fsPath));
					if (file[0] === "/") {
						file = file.substr(1);
					}

					rev = await git.getFileCurrentRevision(uri.fsPath);
					const gitRemotes = await git.getRepoRemotes(repoPath);
					remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

					const gitAuthors = await git.getFileAuthors(uri.fsPath, {
						startLine: range.start.line,
						endLine: range.end.line - 1,
						contents: dirty ? this.lastFullCode : undefined
					});
					const authorEmails = gitAuthors.map(a => a.email);

					const users = await Container.instance().users.getByEmails(authorEmails);
					authors = [...Iterables.map(users, u => ({ id: u.id, username: u.username }))];
				}
			} catch (ex) {
				gitError = ex.toString();
				Logger.error(ex);
				debugger;
			}
		}

		return {
			code: document.getText(range),
			source:
				repoPath !== undefined
					? {
							file: file!,
							repoPath: repoPath,
							revision: rev!,
							authors: authors || [],
							remotes: remotes || []
					  }
					: undefined,
			gitError: gitError
		};
	}

	@lspHandler(DeletePostRequestType)
	deletePost(request: DeletePostRequest): Promise<DeletePostResponse> {
		return this.session.api.deletePost(request);
	}

	@lspHandler(EditPostRequestType)
	editPost(request: EditPostRequest): Promise<EditPostResponse> {
		return this.session.api.editPost(request);
	}

	@lspHandler(MarkPostUnreadRequestType)
	markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse> {
		return this.session.api.markPostUnread(request);
	}

	@lspHandler(ReactToPostRequestType)
	reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse> {
		return this.session.api.reactToPost(request);
	}

	@lspHandler(GetPostRequestType)
	private async getPost(request: GetPostRequest): Promise<GetPostResponse> {
		const post = await this.getById(request.postId);
		return { post: post };
	}

	protected getEntityName(): string {
		return "Post";
	}
}

async function resolveCreatePostResponse(response: CreatePostResponse) {
	const container = Container.instance();
	if (response.codemark) {
		await container.codemarks.resolve({
			type: MessageType.Codemarks,
			data: [response.codemark]
		});
	}
	if (response.markers) {
		await container.markers.resolve({
			type: MessageType.Markers,
			data: response.markers
		});
	}
	if (response.markerLocations) {
		await container.markerLocations.resolve({
			type: MessageType.MarkerLocations,
			data: response.markerLocations
		});
	}
	if (response.repos) {
		await container.repos.resolve({
			type: MessageType.Repositories,
			data: response.repos
		});
	}
	if (response.streams) {
		await container.streams.resolve({
			type: MessageType.Streams,
			data: response.streams
		});
	}
}
