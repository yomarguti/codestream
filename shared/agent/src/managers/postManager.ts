"use strict";

import { Container } from "../container";
import { CSPost } from "../shared/api.protocol";
import { IndexType } from "./index";
import { EntityManager, Id, IndexedField } from "./managers";
import { SequentialSlice } from "./sequentialSlice";

export class PostManager extends EntityManager<CSPost> {
	protected getIndexedFields(): IndexedField<CSPost>[] {
		return [
			{
				field: "streamId",
				seqField: "seqNum",
				type: IndexType.GroupSequential,
				fetchFn: this.fetchByStreamId.bind(this)
			},
			{
				field: "parentPostId",
				type: IndexType.Group,
				fetchFn: this.fetchChildPosts.bind(this)
			}
		];
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
		// TODO math max 0
		if (after != null && before != null) {
			return await this.getGroupSlice("streamId", streamId, after + 1, before);
		} else if (after != null && limit != null) {
			return await this.getGroupSlice("streamId", streamId, after + 1, after + limit + 1);
		} else if (before != null && limit != null) {
			return await this.getGroupSlice("streamId", streamId, before - limit, before);
		} else if (limit != null) {
			return await this.getGroupTail("streamId", streamId, limit);
		}
		throw new Error("Missing required arguments in invocation to PostManager.getPosts()");
	}

	getChildPosts(parentPostId: Id): Promise<CSPost[]> {
		return this.getManyBy("parentPostId", parentPostId);
	}

	protected async fetch(id: Id): Promise<CSPost> {
		const { api, state } = Container.instance();
		const response = await api.getPost(state.apiToken, state.teamId, id);
		return response.post;
	}

	protected async fetchChildPosts(parentPostId: Id): Promise<CSPost[]> {
		const { api, state } = Container.instance();
		const response = await api.getChildPosts(state.apiToken, state.teamId, parentPostId);
		return response.posts;
	}

	protected async fetchByStreamId(
		streamId: string,
		seqStart?: number,
		seqEnd?: number,
		limit: number = 100
	): Promise<CSPost[]> {
		const { api, state } = Container.instance();
		if (seqStart && seqEnd) {
			const minSeq = seqStart;
			const maxSeq = seqEnd - 1;
			const response = await api.getPostsBySequence(
				state.apiToken,
				state.teamId,
				streamId,
				minSeq,
				maxSeq
			);
			return response.posts;
		} else {
			let lessThan = undefined;
			let posts: CSPost[] = [];

			while (true) {
				const response = await api.getPostsLesserThan(
					state.apiToken,
					state.teamId,
					streamId,
					limit,
					lessThan
				);
				posts = posts.concat(response.posts);
				if (response.more) {
					lessThan = posts[posts.length - 1].id;
				} else {
					return posts;
				}
			}
		}
	}
}
