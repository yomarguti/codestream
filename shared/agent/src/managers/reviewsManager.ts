"use strict";
import { applyPatch } from "diff";
import * as path from "path";
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
	UpdateReviewResponse,
	DeleteReviewRequest,
	DeleteReviewRequestType,
	StartReviewRequestType,
	StartReviewRequest,
	StartReviewResponse,
	PauseReviewRequestType,
	PauseReviewRequest,
	PauseReviewResponse,
	EndReviewResponse,
	EndReviewRequest,
	EndReviewRequestType
} from "../protocol/agent.protocol";
import { CSReview, CSReviewDiffs } from "../protocol/api.protocol";
import { log, lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

const uriRegexp = /codestream-diff:\/\/(\w+)\/(\w+)\/(\w+)\/(.+)/;

@lsp
export class ReviewsManager extends CachedEntityManagerBase<CSReview> {
	private readonly _diffs = new Map<string, { [repoId: string]: CSReviewDiffs }>();

	static parseUri(
		uri: string
	): { reviewId: string; repoId: string; version: string; path: string } {
		const match = uriRegexp.exec(uri);
		if (match == null) throw new Error(`URI ${uri} doesn't match codestream-diff format`);

		const [, reviewId, repoId, version, path] = match;

		return {
			reviewId,
			repoId,
			version,
			path
		};
	}

	@lspHandler(FetchReviewsRequestType)
	async get(request?: FetchReviewsRequest): Promise<FetchReviewsResponse> {
		let reviews = await this.getAllCached();
		if (request != null) {
			if (request.reviewIds?.length ?? 0 > 0) {
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

	async getDiffs(reviewId: string, repoId: string): Promise<CSReviewDiffs> {
		const diffsByRepo = await this.getAllDiffs(reviewId);
		return diffsByRepo[repoId];
	}

	private async getAllDiffs(reviewId: string): Promise<{ [repoId: string]: CSReviewDiffs }> {
		if (!this._diffs.has(reviewId)) {
			const response = await this.session.api.fetchReviewDiffs({ reviewId });
			this._diffs.set(reviewId, response);
		}

		const diffsByRepo = this._diffs.get(reviewId);
		if (!diffsByRepo) {
			throw new Error(`Cannot find diffs for review ${reviewId}`);
		}

		return diffsByRepo;
	}

	@lspHandler(GetReviewContentsRequestType)
	async getContents(request: GetReviewContentsRequest): Promise<GetReviewContentsResponse> {
		const { git } = SessionContainer.instance();
		const review = await this.getById(request.reviewId);
		const changeset = review.reviewChangesets.find(c => c.repoId === request.repoId);
		if (!changeset) throw new Error(`Could not find changeset with repoId ${request.repoId}`);

		const diffs = await this.getDiffs(request.reviewId, request.repoId);
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

	@lspHandler(DeleteReviewRequestType)
	delete(request: DeleteReviewRequest) {
		return this.session.api.deleteReview(request);
	}

	@lspHandler(StartReviewRequestType)
	async startReview(request: StartReviewRequest): Promise<StartReviewResponse> {
		const { git } = SessionContainer.instance();
		const review = await this.getById(request.reviewId);
		const diffsByRepo = await this.getAllDiffs(review.id);
		for (const repoId in diffsByRepo) {
			const repo = await git.getRepositoryById(repoId);
			if (repo == null) {
				return {
					success: false,
					error: "The git repository for this review is not currently open in the IDE"
				};
			}

			const diffs = diffsByRepo[repoId];
			const commit = await git.getCommit(repo.path, diffs.leftBaseSha);
			if (commit == null) {
				return {
					success: false,
					error: `The base commit for this review (${diffs.leftBaseSha}, authored by ${diffs.leftBaseAuthor})
was not found in the local git repository. Fetch all remotes and try again.`
				};
			}
		}

		return {
			success: true
		};
	}

	@lspHandler(PauseReviewRequestType)
	async pauseReview(request: PauseReviewRequest): Promise<PauseReviewResponse> {
		return {
			success: true
		};
	}

	@lspHandler(EndReviewRequestType)
	async endReview(request: EndReviewRequest): Promise<EndReviewResponse> {
		return {
			success: true
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
