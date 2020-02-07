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
import { CSReview, CSReviewDiffs } from "../protocol/api.protocol";
import { log, lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class ReviewsManager extends CachedEntityManagerBase<CSReview> {

	private readonly _diffs = new Map<string, { [repoId: string]: CSReviewDiffs }>();

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

	private async getDiffs(reviewId: string, repoId: string, path: string): Promise<CSReviewDiffs> {
		if (!this._diffs.has(reviewId)) {
			const response = await this.session.api.fetchReviewDiffs({ reviewId });
			this._diffs.set(reviewId, response);
		}

		const reviewDiffs = this._diffs.get(reviewId);
		if (!reviewDiffs) {
			throw new Error(`Cannot find diffs for reviewe ${reviewId}`);
		}

		return reviewDiffs[repoId];
	}

	@lspHandler(GetReviewContentsRequestType)
	async getContents(request: GetReviewContentsRequest): Promise<GetReviewContentsResponse> {
		const { git, reviews } = SessionContainer.instance();
		const review = await reviews.getById(request.reviewId);
		const changeset = review.reviewChangesets.find(c => c.repoId === request.repoId);
		if (!changeset) throw new Error(`Could not find changeset with repoId ${request.repoId}`);

		const diffs = await this.getDiffs(request.reviewId, request.repoId, request.path);
		const diff = diffs.localDiffs.find(d => d.newFileName === request.path);

		const repo = await git.getRepositoryById(request.repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${request.repoId}`);
		}

		const filePath = path.join(repo.normalizedPath, request.path);
		const baseSha = await git.getParentCommit(repo.normalizedPath, changeset.commits[0].sha);

		const baseContents = baseSha !== undefined ? await git.getFileContentForRevision(filePath, baseSha) || "" : "";
		const pushedContents = await git.getFileContentForRevision(filePath, diffs.localDiffSha) || "";
		const headContents = diff !== undefined ? applyPatch(pushedContents, diff) : pushedContents;

		return {
			base: baseContents,
			head: headContents
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
