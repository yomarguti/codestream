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
	GetAllReviewContentsRequest,
	GetAllReviewContentsRequestType,
	GetAllReviewContentsResponse,
	GetReviewContentsLocalRequest,
	GetReviewContentsLocalRequestType,
	GetReviewContentsRequest,
	GetReviewContentsRequestType,
	GetReviewContentsResponse,
	GetReviewRequest,
	GetReviewRequestType,
	GetReviewResponse,
	PauseReviewRequest,
	PauseReviewRequestType,
	PauseReviewResponse,
	ReviewFileContents,
	ReviewRepoContents,
	StartReviewRequest,
	StartReviewRequestType,
	StartReviewResponse,
	UpdateReviewRequest,
	UpdateReviewRequestType,
	UpdateReviewResponse
} from "../protocol/agent.protocol";
import { CSReview, CSReviewDiffs, FileStatus } from "../protocol/api.protocol";
import { log, lsp, lspHandler, Strings } from "../system";
import { xfs } from "../xfs";
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

	@lspHandler(GetReviewContentsLocalRequestType)
	@log()
	async getContentsLocal(
		request: GetReviewContentsLocalRequest
	): Promise<GetReviewContentsResponse> {
		const { git } = SessionContainer.instance();

		const repo = await git.getRepositoryById(request.repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${request.repoId}`);
		}

		const leftBasePath = path.join(repo.path, request.path);
		// const rightBasePath = path.join(repo.path, rightBaseRelativePath);

		const leftContents =
			// fileInfo.statusX === FileStatus.added
			// ? ""
			// :
			(await git.getFileContentForRevision(leftBasePath, request.baseSha)) || "";

		let rightContents: string | undefined = "";
		switch (request.rightVersion) {
			case "head":
				const revision = await git.getFileCurrentRevision(leftBasePath);
				if (revision) {
					rightContents = await git.getFileContentForRevision(leftBasePath, revision);
				}
				break;
			case "staged":
				rightContents = await git.getFileContentForRevision(leftBasePath, "HEAD");
				break;
			case "saved":
				rightContents = await xfs.readText(leftBasePath);
				break;
		}

		return {
			left: leftContents,
			right: rightContents || ""
		};
	}

	@lspHandler(GetAllReviewContentsRequestType)
	@log()
	async getAllContents(
		request: GetAllReviewContentsRequest
	): Promise<GetAllReviewContentsResponse> {
		const review = await this.getById(request.reviewId);
		const repos: ReviewRepoContents[] = [];
		for (const changeset of review.reviewChangesets) {
			const files: ReviewFileContents[] = [];
			for (const file of changeset.modifiedFiles) {
				const contents = await this.getContents({
					reviewId: review.id,
					repoId: changeset.repoId,
					path: file.file
				});
				files.push({
					leftPath: file.oldFile,
					rightPath: file.file,
					path: file.file,
					left: contents.left,
					right: contents.right
				});
			}

			repos.push({
				repoId: changeset.repoId,
				files
			});
		}
		return { repos };
	}

	@lspHandler(GetReviewContentsRequestType)
	@log()
	async getContents(request: GetReviewContentsRequest): Promise<GetReviewContentsResponse> {
		const { git } = SessionContainer.instance();

		const review = await this.getById(request.reviewId);
		const changeset = review.reviewChangesets.find(c => c.repoId === request.repoId);
		if (!changeset) throw new Error(`Could not find changeset with repoId ${request.repoId}`);
		const fileInfo = changeset.modifiedFiles.find(f => f.file === request.path);
		if (!fileInfo) throw new Error(`Could not find changeset file information for ${request.path}`);

		const diffs = await this.getDiffs(request.reviewId, request.repoId);
		const leftDiff = diffs.leftDiffs.find(
			d => d.newFileName === fileInfo.oldFile || d.oldFileName === fileInfo.oldFile
		);
		const leftBaseRelativePath = (leftDiff && leftDiff.oldFileName) || fileInfo.oldFile;
		const rightDiff = diffs.rightDiffs?.find(
			d => d.newFileName === fileInfo.file || d.oldFileName === fileInfo.file
		);
		const rightBaseRelativePath = (rightDiff && rightDiff.oldFileName) || fileInfo.file;

		const repo = await git.getRepositoryById(request.repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${request.repoId}`);
		}

		const leftBasePath = path.join(repo.path, leftBaseRelativePath);
		const rightBasePath = path.join(repo.path, rightBaseRelativePath);

		const isNewFile =
			fileInfo.statusX === FileStatus.added || fileInfo.statusX === FileStatus.untracked;
		const leftBaseContents = isNewFile
			? ""
			: (await git.getFileContentForRevision(leftBasePath, diffs.leftBaseSha)) || "";
		const normalizedLeftBaseContents = Strings.normalizeFileContents(leftBaseContents);
		const leftContents =
			leftDiff !== undefined
				? applyPatch(normalizedLeftBaseContents, leftDiff)
				: normalizedLeftBaseContents;
		const rightBaseContents = isNewFile
			? ""
			: diffs.leftBaseSha === diffs.rightBaseSha
			? leftBaseContents
			: (await git.getFileContentForRevision(rightBasePath, diffs.rightBaseSha)) || "";
		const normalizedRightBaseContents = Strings.normalizeFileContents(rightBaseContents);
		const rightContents =
			rightDiff !== undefined
				? applyPatch(normalizedRightBaseContents, rightDiff)
				: normalizedRightBaseContents;

		return {
			left: leftContents,
			right: rightContents
		};
	}

	@lspHandler(UpdateReviewRequestType)
	async update(request: UpdateReviewRequest): Promise<UpdateReviewResponse> {
		if (request.repoChanges) {
			const { posts } = SessionContainer.instance();

			// FIXME -- this is hot garbage
			const { reviewChangesets, ...rest } = request;
			try {
				const r = await posts.createSharingReviewPost({
					attributes: { ...rest },
					shortCircuitAndReturnReviewChangesets: true
				});
				// @ts-ignore
				request.reviewChangesets = r;
				delete request.repoChanges;
				// END FIXME -- this is hot garbage
			} catch (e) {
				Logger.warn("Error in reviewsManager.update: ", e);
			}
		}

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
		const { git, repositoryMappings } = SessionContainer.instance();
		const review = await this.getById(request.reviewId);
		const diffsByRepo = await this.getAllDiffs(review.id);
		for (const repoId in diffsByRepo) {
			const repo = await git.getRepositoryById(repoId);
			let repoPath;
			if (repo === undefined) {
				repoPath = await repositoryMappings.getByRepoId(repoId);
			} else {
				repoPath = repo.path;
			}
			if (repoPath == null) {
				return {
					success: false,
					error: {
						message: "The git repository for this review is not currently open in the IDE",
						type: "REPO_NOT_FOUND"
					}
				};
			}

			const diffs = diffsByRepo[repoId];
			let leftCommit = await git.getCommit(repoPath, diffs.leftBaseSha);
			let rightCommit = await git.getCommit(repoPath, diffs.rightBaseSha);
			if (leftCommit == null || rightCommit == null) {
				const didFetch = await git.fetchAllRemotes(repoPath);
				if (didFetch) {
					leftCommit = leftCommit || (await git.getCommit(repoPath, diffs.leftBaseSha));
					rightCommit = rightCommit || (await git.getCommit(repoPath, diffs.rightBaseSha));
				}
			}

			function missingCommitError(sha: string, author: string) {
				const shortSha = sha.substr(0, 8);
				return {
					success: false,
					error: {
						message: `A commit required to perform this review (${shortSha}, authored by ${author}) was not found in the local git repository. Fetch all remotes and try again.`,
						type: "COMMIT_NOT_FOUND"
					}
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
