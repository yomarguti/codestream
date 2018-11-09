"use strict";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
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
	ReactToPostRequest,
	ReactToPostRequestType,
	ReactToPostResponse,
	SetPostStatusRequest,
	SetPostStatusRequestType,
	SetPostStatusResponse
} from "../shared/agent.protocol";
import { CSCodemark, CSPost } from "../shared/api.protocol";
import { lsp, lspHandler, Strings } from "../system";
import { BaseIndex, IndexParams, IndexType } from "./cache";
import { getValues, KeyValue, UniqueFetchFn } from "./cache/baseCache";
import { EntityCache } from "./cache/entityCache";
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
		if (Number(post.seqNum) > Number(this.latest.seqNum)) {
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

class PostsCache extends EntityCache<CSPost> {
	private readonly postIndex: PostIndex;

	constructor(
		idxFields: IndexParams<CSPost>[],
		fetchById: UniqueFetchFn<CSPost>,
		private readonly fetchPosts: FetchPostsFn
	) {
		super(idxFields, fetchById);
		this.postIndex = new PostIndex(fetchPosts);
		this.indexes.set("streamId", this.postIndex);
	}

	async getPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const start = process.hrtime();
		Logger.log(`PostManager: retrieving posts streamId=${request.streamId}`);
		let { posts, more } = this.postIndex.getPosts(request);
		if (posts === undefined) {
			Logger.log(`PostManager: cache miss streamId=${request.streamId}`);
			const response = await this.fetchPosts(request);
			Logger.log(`PostManager: caching posts streamId=${request.streamId}`);

			this.set(response.posts);

			this.postIndex.setPosts(request, response);
			posts = response.posts;
			more = response.more;
		} else {
			Logger.log(`PostManager: cache hit streamId=${request.streamId}`);
		}

		Logger.log(
			`PostManager: returning ${
				posts!.length
			} posts (more=${more}) in ${Strings.getDurationMilliseconds(start)}ms streamId=${
				request.streamId
			}`
		);

		return { posts: posts!, more };
	}

	private _streamInitialization = new Map<Id, Promise<void>>();
	async ensureStreamInitialized(streamId: Id): Promise<void> {
		if (this.postIndex.isStreamInitialized(streamId)) {
			return;
		} else {
			const promise = this._streamInitialization.get(streamId);
			if (promise) {
				await promise;
			} else {
				Logger.log(`PostCache: initializing stream ${streamId}`);
				const newPromise = this.getPosts({
					streamId: streamId,
					limit: 100
				});
				this._streamInitialization.set(streamId, newPromise as Promise<any>);
				await newPromise;
			}
		}
	}
}

@lsp
export class PostsManager extends EntityManagerBase<CSPost> {
	protected readonly cache: PostsCache = new PostsCache(
		this.getIndexedFields(),
		this.fetchById.bind(this),
		this.fetchPosts.bind(this)
	);

	async cacheSet(entity: CSPost, oldEntity?: CSPost): Promise<void> {
		if (entity && entity.streamId) {
			await this.cache.ensureStreamInitialized(entity.streamId);
		}

		super.cacheSet(entity, oldEntity);
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
		const cacheResponse = await this.cache.getPosts(request);
		const fullPosts = await this.fullPosts(cacheResponse.posts);
		return {
			posts: fullPosts,
			more: cacheResponse.more
		};
	}

	async fullPosts(csPosts: CSPost[]): Promise<CSFullPost[]> {
		const fullPosts = [];
		for (const csPost of csPosts) {
			let fullCodemark: CSFullCodemark | undefined;
			let hasMarkers = false;
			if (csPost.codemarkId) {
				const csCodemark = await Container.instance().codemarks.getById(csPost.codemarkId);
				fullCodemark = {
					...csCodemark
				};
				if (csCodemark.markerIds) {
					fullCodemark.markers = [];
					for (const markerId of csCodemark.markerIds) {
						fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
						hasMarkers = true;
					}
				}
			}
			fullPosts.push({
				...csPost,
				codemark: fullCodemark,
				hasMarkers
			});
		}
		return fullPosts;
	}

	@lspHandler(FetchPostRepliesRequestType)
	async getReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		const posts = await this.cache.getGroup([
			["streamId", request.streamId],
			["parentPostId", request.postId]
		]);
		return { posts };
	}

	@lspHandler(CreatePostRequestType)
	createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
		const resp = this.session.api.createPost(request);
		resp.then(() => {
			try {
				const telemetry = Container.instance().telemetry;
				let isMarker = false;
				// Check if it's a marker
				if (request.codemark != null) {
					isMarker = true;
				}
				const payload: {
					[key: string]: any;
				} = {
					Type: "Chat",
					Thread: request.parentPostId ? "Reply" : "Parent",
					Marker: isMarker
				};
				// TODO: Add Category
				if (!Container.instance().session.telemetryData.hasCreatedPost) {
					payload["First Post?"] = new Date().toISOString();
					Container.instance().session.telemetryData.hasCreatedPost = true;
				}
				telemetry.track({ eventName: "Post Created", properties: payload });
			} catch (ex) {
				Logger.error(ex);
			}
		});

		return resp;
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

	@lspHandler(SetPostStatusRequestType)
	setPostStatus(request: SetPostStatusRequest): Promise<SetPostStatusResponse> {
		return this.session.api.setPostStatus(request);
	}

	@lspHandler(GetPostRequestType)
	private async getPost(request: GetPostRequest): Promise<GetPostResponse> {
		const post = await this.getById(request.postId);
		return { post: post };
	}
}
