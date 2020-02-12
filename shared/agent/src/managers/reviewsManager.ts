"use strict";
import { applyPatch, ParsedDiff } from "diff";
import * as path from "path";
import { URI } from "vscode-uri";
import { MessageType } from "../api/apiProvider";
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
	GetReviewResponse,
	UpdateReviewRequest,
	UpdateReviewRequestType,
	UpdateReviewResponse
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
			throw new Error(`Cannot find diffs for review ${reviewId}`);
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
		const leftDiff = diffs.leftDiffs.find(d => d.newFileName === request.path);
		const rightDiff = diffs.rightDiffs?.find(d => d.newFileName === request.path);

		const repo = await git.getRepositoryById(request.repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${request.repoId}`);
		}

		const filePath = path.join(repo.path, request.path);

		const leftBaseContents =
			(await git.getFileContentForRevision(filePath, diffs.leftBaseSha)) || "";
		const leftContents =
			leftDiff !== undefined ? applyPatch(leftBaseContents, leftDiff) : leftBaseContents;
		const rightBaseContents =
			diffs.leftBaseSha === diffs.rightBaseSha
				? leftBaseContents
				: (await git.getFileContentForRevision(filePath, diffs.rightBaseSha)) || "";
		const rightContents =
			rightDiff !== undefined ? applyPatch(rightBaseContents, rightDiff) : rightBaseContents;

		return {
			base: leftContents,
			head: rightContents
		};
	}

	@lspHandler(UpdateReviewRequestType)
	async update(request: UpdateReviewRequest): Promise<UpdateReviewResponse> {
		const updateResponse = await this.session.api.updateReview(request);
		const [review] = await this.resolve({
			type: MessageType.Reviews,
			data: [updateResponse.review]
		});

		return { review };
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
