"use strict";

import { Container } from "../container";
import {
	CSFullCodemark,
	FetchCodemarksRequest,
	FetchCodemarksRequestType,
	FetchCodemarksResponse
} from "../shared/agent.protocol.markers";
import { CSCodemark } from "../shared/api.protocol.models";
import { lspHandler } from "../system/decorators";
import { CachedEntityManagerBase, Id } from "./entityManager";

export class CodemarksManager extends CachedEntityManagerBase<CSCodemark> {
	@lspHandler(FetchCodemarksRequestType)
	async get(request: FetchCodemarksRequest): Promise<FetchCodemarksResponse> {
		const csCodemarks = await this.ensureCached();
		const fullCodemarks = [];

		for (const csCodemark of csCodemarks) {
			const fullCodemark = {
				...csCodemark
			} as CSFullCodemark;
			if (csCodemark.markerIds) {
				fullCodemark.markers = [];
				for (const markerId of csCodemark.markerIds) {
					fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
				}
			}
			fullCodemarks.push(fullCodemark);
		}

		return { codemarks: fullCodemarks };
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
