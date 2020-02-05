"use strict";
import {
	FetchReviewsRequest,
	FetchReviewsRequestType,
	FetchReviewsResponse,
	GetReviewContentsRequest,
	GetReviewContentsResponse,
	GetReviewContentsRequestType,
	GetReviewRequestType,
	GetReviewRequest,
	GetReviewResponse
} from "../protocol/agent.protocol";
import { CSReview } from "../protocol/api.protocol";
import { lsp, lspHandler, log } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

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

	@lspHandler(GetReviewRequestType)
	@log()
	async getReview(request: GetReviewRequest): Promise<GetReviewResponse> {
		const review = await this.getById(request.reviewId);
		return { review };
	}

	@lspHandler(GetReviewContentsRequestType)
	async getContents(request: GetReviewContentsRequest): Promise<GetReviewContentsResponse> {
		return {
			base: "Work\nin\nprogress\n",
			head: "Work\nundergoing some\nprogress"
		};
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
