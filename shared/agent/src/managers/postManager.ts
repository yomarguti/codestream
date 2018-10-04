"use strict";

import { Container } from "../container";
import { CSPost } from "../shared/api.protocol";
import { IndexParams, IndexType } from "./index";
import { EntityManager, Id } from "./managers";
import { SequentialSlice } from "./sequentialSlice";

export class PostManager extends EntityManager<CSPost> {
	protected getIndexedFields(): IndexParams<CSPost>[] {
		return [
			{
				fields: ["streamId"],
				seqField: "seqNum",
				type: IndexType.GroupSequential,
				fetchFn: this.fetchByStreamId.bind(this)
			},
			{
				fields: ["parentPostId"],
				type: IndexType.Group,
				fetchFn: this.fetchByParentPostId.bind(this)
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

	getByParentPostId(parentPostId: Id): Promise<CSPost[]> {
		return this.cache.getGroup([["parentPostId", parentPostId]]);
	}

	protected async fetch(id: Id): Promise<CSPost> {
		const { api, state } = Container.instance();
		const response = await api.getPost(state.apiToken, state.teamId, id);
		return response.post;
	}

	protected async fetchByParentPostId(values: any[]): Promise<CSPost[]> {
		const [parentPostId] = values;
		const { api, state } = Container.instance();
		const response = await api.getChildPosts(state.apiToken, state.teamId, parentPostId);
		return response.posts;
	}

	protected async fetchByStreamId(
		values: any[],
		seqStart?: number,
		seqEnd?: number,
		limit: number = 100
	): Promise<CSPost[]> {
		const [streamId] = values;
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
