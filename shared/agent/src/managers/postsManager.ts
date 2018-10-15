"use strict";
import { Container } from "../container";
import { Logger } from "../logger";
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
import { CSPost } from "../shared/api.protocol";
import { lsp, lspHandler } from "../system";
import { getValues, KeyValue } from "./cache/baseCache";
import { IndexParams, IndexType } from "./cache/index";
import { EntityManagerBase, Id } from "./entityManager";

@lsp
export class PostsManager extends EntityManagerBase<CSPost> {
	getIndexedFields(): IndexParams<CSPost>[] {
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
		const resp = this.session.api.createPost(request);
		resp.then(() => {
			try {
				const telemetry = Container.instance().telemetry;
				let isMarker = false;
				// Check if it's a marker
				if (request.codeBlocks != null && request.codeBlocks.length > 0) {
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

	@lspHandler(FetchPostsRequestType)
	get(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		return this.session.api.fetchPosts(request);

		// const posts = await this.getPosts(
		// 	request.streamId,
		// 	request.after,
		// 	request.before,
		// 	request.limit
		// );
		// return { posts: posts.data };
	}

	@lspHandler(FetchPostRepliesRequestType)
	async getReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		return this.session.api.fetchPostReplies(request);

		// const posts = await this.cache.getGroup([["parentPostId", request.postId]]);
		// return { posts: posts };
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

	// /**
	//  * Retrieve posts in a stream. One of the following combination of arguments must be supplied:
	//  * - after and before
	//  * - after and limit
	//  * - before and limit
	//  * - limit
	//  * After and before refer to sequence numbers. If neither is specified, then the latest posts
	//  * will be returned.
	//  *
	//  * @param streamId {Id} The streamId
	//  * @param after {number} If specified, returns only posts after this sequence number
	//  * @param before {number} If specified, returns only posts before this sequence number
	//  * @param limit {number} Maximum number of posts to be retrieved
	//  *
	//  * @return {SequentialSlice}
	//  */
	// async getPosts(
	// 	streamId: Id,
	// 	after?: number | string,
	// 	before?: number | string,
	// 	limit?: number
	// ): Promise<SequentialSlice<CSPost>> {
	// 	let seqStart;
	// 	let seqEnd;

	// 	if (after != null && before != null) {
	// 		seqStart = Math.max(after + 1, 1);
	// 		seqEnd = before;
	// 	} else if (after != null && limit != null) {
	// 		seqStart = Math.max(after + 1, 1);
	// 		seqEnd = seqStart + limit + 1;
	// 	} else if (before != null && limit != null) {
	// 		seqStart = Math.max(before - limit, 1);
	// 		seqEnd = before;
	// 	}

	// 	if (seqStart !== undefined && seqEnd !== undefined) {
	// 		return this.cache.getGroupSlice([["streamId", streamId]], seqStart, seqEnd);
	// 	} else {
	// 		return await this.cache.getGroupTail([["streamId", streamId]], limit || 100);
	// 	}
	// }

	protected async fetchById(id: Id): Promise<CSPost> {
		// TODO: Must fix this for slack
		const response = await this.session.api.getPost({ streamId: undefined!, postId: id });
		return response.post;
	}

	protected async fetchByParentPostId(criteria: KeyValue<CSPost>[]): Promise<CSPost[]> {
		const [parentPostId] = getValues(criteria);
		const response = await this.session.api.fetchPostReplies({
			streamId: undefined!,
			postId: parentPostId
		});
		return response.posts;
	}

	protected async fetchByStreamId(
		criteria: KeyValue<CSPost>[],
		seqStart?: number,
		seqEnd?: number,
		limit: number = 100
	): Promise<CSPost[]> {
		const [streamId] = getValues(criteria);

		if (seqStart && seqEnd) {
			const minSeq = seqStart;
			const maxSeq = seqEnd - 1;
			const response = await this.session.api.fetchPosts({
				streamId: streamId,
				before: maxSeq,
				after: minSeq,
				inclusive: true
			});
			return response.posts;
		}

		let lessThan = undefined;
		const posts: CSPost[] = [];

		while (true) {
			const response = await this.session.api.fetchPosts({
				streamId: streamId,
				limit: limit,
				before: lessThan
			});
			posts.push(...response.posts);

			if (!response.more) return posts;

			lessThan = posts[posts.length - 1].id;
		}
	}
}
