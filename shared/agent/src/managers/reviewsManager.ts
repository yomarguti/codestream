"use strict";
import { applyPatch } from "diff";
import * as path from "path";
import { MessageType } from "../api/apiProvider";
import { SessionContainer } from "../container";
import { git } from "../git/git";
import { Logger } from "../logger";
import {
	CheckReviewPreconditionsRequest,
	CheckReviewPreconditionsRequestType,
	CheckReviewPreconditionsResponse,
	DeleteReviewRequest,
	DeleteReviewRequestType,
	EndReviewRequest,
	EndReviewRequestType,
	EndReviewResponse,
	FetchReviewsRequest,
	FetchReviewsRequestType,
	FetchReviewsResponse,
	GetReviewContentsRequest,
	GetReviewContentsRequestType,
	GetReviewContentsResponse,
	GetReviewRequest,
	GetReviewRequestType,
	GetReviewResponse,
	PauseReviewRequest,
	PauseReviewRequestType,
	PauseReviewResponse,
	StartReviewRequest,
	StartReviewRequestType,
	StartReviewResponse,
	UpdateReviewRequest,
	UpdateReviewRequestType,
	UpdateReviewResponse
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
		const fileInfo = changeset.modifiedFiles.find(f => f.file === request.path);
		if (!fileInfo) throw new Error(`Could not find changeset file information for ${request.path}`);

		const diffs = await this.getDiffs(request.reviewId, request.repoId);
		const leftDiff = diffs.leftDiffs.find(d => d.newFileName === fileInfo.oldFile);
		const leftBaseRelativePath = (leftDiff && leftDiff.oldFileName) || fileInfo.oldFile;
		const rightDiff = diffs.rightDiffs?.find(d => d.newFileName === fileInfo.file);
		const rightBaseRelativePath = (rightDiff && rightDiff.oldFileName) || fileInfo.file;

		const repo = await git.getRepositoryById(request.repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${request.repoId}`);
		}

		const leftBasePath = path.join(repo.path, leftBaseRelativePath);
		const rightBasePath = path.join(repo.path, rightBaseRelativePath);

		const leftBaseContents =
			(await git.getFileContentForRevision(leftBasePath, diffs.leftBaseSha)) || "";
		const leftContents =
			leftDiff !== undefined ? applyPatch(leftBaseContents, leftDiff) : leftBaseContents;
		const rightBaseContents =
			diffs.leftBaseSha === diffs.rightBaseSha
				? leftBaseContents
				: (await git.getFileContentForRevision(rightBasePath, diffs.rightBaseSha)) || "";
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

	@lspHandler(CheckReviewPreconditionsRequestType)
	async checkReviewPreconditions(
		request: CheckReviewPreconditionsRequest
	): Promise<CheckReviewPreconditionsResponse> {
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
			let leftCommit = await git.getCommit(repo.path, diffs.leftBaseSha);
			let rightCommit = await git.getCommit(repo.path, diffs.rightBaseSha);
			if (leftCommit == null || rightCommit == null) {
				const didFetch = await git.fetchAllRemotes(repo.path);
				if (didFetch) {
					leftCommit = leftCommit || (await git.getCommit(repo.path, diffs.leftBaseSha));
					rightCommit = rightCommit || (await git.getCommit(repo.path, diffs.rightBaseSha));
				}
			}

			function missingCommitError(sha: string, author: string) {
				const shortSha = sha.substr(0, 8);
				return {
					success: false,
					error: `A commit required to perform this review (${shortSha}, authored by ${author})
was not found in the local git repository. Fetch all remotes and try again.`
				};
			}

			if (leftCommit == null) {
				return missingCommitError(diffs.leftBaseSha, diffs.leftBaseAuthor);
			}
			if (rightCommit == null) {
				return missingCommitError(diffs.rightBaseSha, diffs.rightBaseAuthor);
			}
		}

		return {
			success: true
		};
	}

	@lspHandler(StartReviewRequestType)
	async startReview(request: StartReviewRequest): Promise<StartReviewResponse> {
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
