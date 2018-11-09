"use strict";

import { Container } from "../container";
import {
	GetPostsWithCodemarksRequest,
	GetPostsWithCodemarksRequestType,
	GetPostsWithCodemarksResponse
} from "../shared/agent.protocol.markers";
import { CSCodemark } from "../shared/api.protocol.models";
import { lspHandler } from "../system/decorators";
import { CachedEntityManagerBase, Id } from "./entityManager";

export class CodemarksManager extends CachedEntityManagerBase<CSCodemark> {
	@lspHandler(GetPostsWithCodemarksRequestType)
	async get(request: GetPostsWithCodemarksRequest): Promise<GetPostsWithCodemarksResponse> {
		const csCodemarks = await this.ensureCached();
		const csPosts = [];

		for (const csCodemark of csCodemarks) {
			const csPost = await Container.instance().posts.getById(csCodemark.postId);
			csPosts.push(csPost);
		}

		const fullPosts = await Container.instance().posts.fullPosts(csPosts);

		return { posts: fullPosts };
	}

	protected async fetchById(id: Id): Promise<CSCodemark> {
		const response = await this.session.api.getCodemark({ codemarkId: id });
		return response.codemark;
	}

	protected async loadCache(): Promise<void> {
		const response = await this.session.api.fetchCodemarks({});

		if (response.posts) {
			for (const post of response.posts) {
				await Container.instance().posts.cacheSet(post);
			}
		}

		if (response.markers) {
			for (const marker of response.markers) {
				Container.instance().markers.cacheSet(marker);
			}
		}

		this.cache.set(response.codemarks);
	}
}
