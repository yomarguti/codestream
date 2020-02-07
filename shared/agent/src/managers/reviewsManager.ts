"use strict";
import { applyPatch, ParsedDiff } from "diff";
import * as path from "path";
import { URI } from "vscode-uri";
import { SessionContainer } from "../container";
import {
	FetchReviewsRequest,
	FetchReviewsRequestType,
	FetchReviewsResponse,
	GetReviewContentsRequest,
	GetReviewContentsRequestType,
	GetReviewContentsResponse,
	GetReviewRequest,
	GetReviewRequestType,
	GetReviewResponse
} from "../protocol/agent.protocol";
import { CSReview } from "../protocol/api.protocol";
import { log, lsp, lspHandler } from "../system";
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
		const { git, repos, reviews } = SessionContainer.instance();
		const review = await reviews.getById(request.reviewId);
		const changeset = review.reviewChangesets.find(
			changeset => changeset.repoId === request.repoId
		);
		// changeset?.diffId
		// const diff = changeset.diffs.find(d => (d as ParsedDiff).newFileName === request.path) as ParsedDiff;
		// const repo = await git.getRepositoryById(request.repoId);
		// if (!repo) {
		// 	throw new Error(`Could not load repo with ID ${request.repoId}`);
		// }

		// const filePath = path.join(repo.normalizedPath, request.path);
		// const baseContents = await git.getFileForRevision(filePath, changeset.diffStart) || "";
		// const headContents = applyPatch(baseContents, diff);

		// return {
		// 	base: baseContents,
		// 	head: headContents
		// };

		return {
			base: "old content",
			head: "new content"
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
