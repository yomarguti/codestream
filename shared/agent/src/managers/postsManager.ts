"use strict";
import {
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	DeletePostRequest,
	DeletePostRequestType,
	DeletePostResponse,
	EditPostRequest,
	EditPostRequestType,
	EditPostResponse,
	FetchLatestPostRequest,
	FetchLatestPostRequestType,
	FetchLatestPostResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesRequestType,
	FetchPostRepliesResponse,
	FetchPostsByRangeRequest,
	FetchPostsByRangeRequestType,
	FetchPostsByRangeResponse,
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
	ReactToPostResponse
} from "../agent";
import { Container } from "../container";
import { CSPost } from "../shared/api.protocol";
import { lspHandler } from "../system/decorators";
import { IndexParams, IndexType } from "./index";
import { EntityManager, Id } from "./managers";
import { SequentialSlice } from "./sequentialSlice";

export class PostsManager extends EntityManager<CSPost> {
	protected getIndexedFields(): IndexParams<CSPost>[] {
		return [
			{
				fields: ["streamId"],
				seqField: "seqNum",
				type: IndexType.GroupSequential,
				fetchFn: this.fetchByStreamId.bind(this)
			},
			{
				// TODO: Need to add streamId into this for slack
				fields: ["parentPostId"],
				type: IndexType.Group,
				fetchFn: this.fetchByParentPostId.bind(this)
			}
		];
	}

	@lspHandler(CreatePostRequestType)
	createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
		return Container.instance().api2.createPost(request);
	}

	@lspHandler(DeletePostRequestType)
	deletePost(request: DeletePostRequest): Promise<DeletePostResponse> {
		return Container.instance().api2.deletePost(request);
	}

	@lspHandler(EditPostRequestType)
	editPost(request: EditPostRequest): Promise<EditPostResponse> {
		return Container.instance().api2.editPost(request);
	}

	@lspHandler(FetchLatestPostRequestType)
	fetchLatestPost(request: FetchLatestPostRequest): Promise<FetchLatestPostResponse> {
		return Container.instance().api2.fetchLatestPost(request);
	}

	@lspHandler(FetchPostRepliesRequestType)
	async fetchPostReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		const posts = await this.cache.getGroup([["parentPostId", request.postId]]);
		return { posts: posts };
	}

	@lspHandler(FetchPostsByRangeRequestType)
	fetchPostsByRange(request: FetchPostsByRangeRequest): Promise<FetchPostsByRangeResponse> {
		return Container.instance().api2.fetchPostsByRange(request);
	}

	@lspHandler(MarkPostUnreadRequestType)
	markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse> {
		return Container.instance().api2.markPostUnread(request);
	}

	@lspHandler(ReactToPostRequestType)
	reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse> {
		return Container.instance().api2.reactToPost(request);
	}

	@lspHandler(GetPostRequestType)
	private async getPost(request: GetPostRequest): Promise<GetPostResponse> {
		const post = await this.getById(request.postId);
		return { post: post };
	}

	@lspHandler(FetchPostsRequestType)
	private async fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const posts = await this.getPosts(
			request.streamId,
			request.afterSeq,
			request.beforeSeq,
			request.limit
		);
		return { posts: posts.data };
	}

	/**
	 * Retrieve posts in a stream. One of the following combination of arguments must be supplied:
	 * - after and before
	 * - after and limit
	 * - before and limit
	 * - limit
	 * After and before refer to sequence numbers. If neither is specified, then the latest posts
	 * will be returned.
	 *
	 * @param streamId {Id} The streamId
	 * @param after {number} If specified, returns only posts after this sequence number
	 * @param before {number} If specified, returns only posts before this sequence number
	 * @param limit {number} Maximum number of posts to be retrieved
	 *
	 * @return {SequentialSlice}
	 */
	async getPosts(
		streamId: Id,
		after?: number,
		before?: number,
		limit?: number
	): Promise<SequentialSlice<CSPost>> {
		let seqStart;
		let seqEnd;

		if (after != null && before != null) {
			seqStart = Math.max(after + 1, 1);
			seqEnd = before;
		} else if (after != null && limit != null) {
			seqStart = Math.max(after + 1, 1);
			seqEnd = seqStart + limit + 1;
		} else if (before != null && limit != null) {
			seqStart = Math.max(before - limit, 1);
			seqEnd = before;
		}

		if (seqStart !== undefined && seqEnd !== undefined) {
			return this.cache.getGroupSlice([["streamId", streamId]], seqStart, seqEnd);
		} else {
			return await this.cache.getGroupTail([["streamId", streamId]], limit || 100);
		}
	}

	protected async fetch(id: Id): Promise<CSPost> {
		// TODO: Must fix this for slack
		const response = await Container.instance().api2.getPost({ streamId: undefined!, postId: id });
		return response.post;
	}

	protected async fetchByParentPostId(values: any[]): Promise<CSPost[]> {
		const [parentPostId] = values;
		const response = await Container.instance().api2.fetchPostReplies({
			streamId: undefined!,
			postId: parentPostId
		});
		return response.posts;
	}

	protected async fetchByStreamId(
		values: any[],
		seqStart?: number,
		seqEnd?: number,
		limit: number = 100
	): Promise<CSPost[]> {
		const [streamId] = values;

		if (seqStart && seqEnd) {
			const minSeq = seqStart;
			const maxSeq = seqEnd - 1;
			const response = await Container.instance().api2.fetchPostsByRange({
				streamId: streamId,
				range: `${minSeq}-${maxSeq}`
			});
			return response.posts;
		}

		let lessThan = undefined;
		const posts: CSPost[] = [];

		while (true) {
			const response = await Container.instance().api2.fetchPostsLesserThan(
				streamId,
				limit,
				lessThan
			);
			posts.push(...response.posts);

			if (!response.more) return posts;

			lessThan = posts[posts.length - 1].id;
		}
	}
}
