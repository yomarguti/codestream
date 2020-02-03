"use strict";
import { CSReview } from "../protocol/api.protocol";
import { lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";
import {
	FetchReviewsRequestType,
	FetchReviewsRequest,
	FetchReviewsResponse
} from "../protocol/agent.protocol";

@lsp
export class ReviewsManager extends CachedEntityManagerBase<CSReview> {
	@lspHandler(FetchReviewsRequestType)
	async get(request?: FetchReviewsRequest): Promise<FetchReviewsResponse> {
		let reviews = await this.getAllCached();
		if (request != null) {
			if (request.reviewIds?.length !== 0) {
				reviews = reviews.filter(r => request.reviewIds!.includes(r.id));
			}
		}

		return { reviews };
	}

	protected async loadCache() {
		const response = await this.session.api.fetchReviews({});
		this.cache.reset(response.reviews);
	}

	protected async fetchById(reviewId: Id): Promise<CSReview> {
		const response = await this.session.api.getReview({ reviewId });
		return response.review;
	}

	protected getEntityName(): string {
		return "Review";
	}
}
