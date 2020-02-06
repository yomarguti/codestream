"use strict";
import {
	FetchReviewChangesetsRequest,
	FetchReviewChangesetsRequestType,
	FetchReviewChangesetsResponse
} from "../protocol/agent.protocol";
import { CSReviewChangeset } from "../protocol/api.protocol";
import { log, lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class ReviewChangesetsManager extends CachedEntityManagerBase<CSReviewChangeset> {
	private cachePerReview = new Map<string, FetchReviewChangesetsResponse>();

	@lspHandler(FetchReviewChangesetsRequestType)
	@log()
	async get(request: FetchReviewChangesetsRequest): Promise<FetchReviewChangesetsResponse> {
		if (this.cachePerReview.has(request.reviewId))
			return this.cachePerReview.get(request.reviewId)!;

		const response = await this.session.api.fetchReviewChangesets(request);

		this.cachePerReview.set(request.reviewId, response);

		return response;
	}

	protected async loadCache() {}

	@log()
	protected async fetchById(changesetId: Id): Promise<CSReviewChangeset> {
		const response = await this.session.api.getReviewChangeset({ changesetId });
		return response.changeset;
	}

	protected getEntityName(): string {
		return "ReviewChangeset";
	}
}
