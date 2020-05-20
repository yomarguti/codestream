"use strict";
import { applyPatch } from "diff";
import * as path from "path";
import { MessageType } from "../api/apiProvider";
import { Container, SessionContainer } from "../container";
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
import {
	CSRepoChange,
	CSReview,
	CSReviewChangeset,
	CSReviewCheckpoint,
	CSReviewDiffs,
	CSTransformedReviewChangeset,
	FileStatus
} from "../protocol/api.protocol";
import { log, lsp, lspHandler, Strings } from "../system";
import { gate } from "../system/decorators/gate";
import { xfs } from "../xfs";
import { CachedEntityManagerBase, Id } from "./entityManager";

const uriRegexp = /codestream-diff:\/\/(\w+)\/(\w+)\/(\w+)\/(.+)/;

@lsp
export class ReviewsManager extends CachedEntityManagerBase<CSReview> {
	private readonly _diffs = new Map<
		string,
		{ [repoId: string]: { checkpoint: CSReviewCheckpoint; diff: CSReviewDiffs }[] }
	>();

	static parseUri(
		uri: string
	): {
		reviewId: string;
		checkpoint: CSReviewCheckpoint;
		repoId: string;
		version: string;
		path: string;
	} {
		const match = uriRegexp.exec(uri);
		if (match == null) throw new Error(`URI ${uri} doesn't match codestream-diff format`);

		const [, reviewId, checkpoint, repoId, version, path] = match;

		return {
			reviewId,
			checkpoint: checkpoint === "undefined" ? undefined : parseInt(checkpoint, 10),
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

	async getDiffs(
		reviewId: string,
		repoId: string
	): Promise<{ checkpoint: CSReviewCheckpoint; diff: CSReviewDiffs }[]> {
		const diffsByRepo = await this.getAllDiffs(reviewId);
		return diffsByRepo[repoId];
	}

	@gate()
	private async getAllDiffs(
		reviewId: string
	): Promise<{ [repoId: string]: { checkpoint: CSReviewCheckpoint; diff: CSReviewDiffs }[] }> {
		if (!this._diffs.has(reviewId)) {
			const responses = await this.session.api.fetchReviewCheckpointDiffs({ reviewId });
			if (responses && responses.length) {
				const result: {
					[repoId: string]: { checkpoint: CSReviewCheckpoint; diff: CSReviewDiffs }[];
				} = {};
				if (responses.length === 1 && responses[0].checkpoint === undefined) {
					const response = responses[0];
					result[response.repoId].push({ checkpoint: 0, diff: response.diffs });
				} else {
					for (const response of responses) {
						if (!result[response.repoId]) {
							result[response.repoId] = [];
						}
						result[response.repoId].push({ checkpoint: response.checkpoint, diff: response.diffs });
					}
				}
				this._diffs.set(reviewId, result);
			}
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

		if (request.editingReviewId) {
			// FIXME this should be the diff relative to the previous checkpoint
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
		const { reviewId, checkpoint } = request;
		const review = await this.getById(reviewId);
		const repos: ReviewRepoContents[] = [];

		const changesetByRepo = new Map<string, CSReviewChangeset>();
		for (const changeset of review.reviewChangesets) {
			if (checkpoint === undefined || checkpoint === changeset.checkpoint) {
				changesetByRepo.set(changeset.repoId, changeset);
			}
		}

		for (const changeset of Array.from(changesetByRepo.values())) {
			const files: ReviewFileContents[] = [];
			const modifiedFiles =
				checkpoint !== undefined ? changeset.modifiedFilesInCheckpoint : changeset.modifiedFiles;
			for (const file of modifiedFiles) {
				const contents = await this.getContents({
					reviewId: review.id,
					repoId: changeset.repoId,
					checkpoint,
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
		const { reviewId, repoId, checkpoint, path } = request;
		if (checkpoint === undefined) {
			const { git } = SessionContainer.instance();
			const review = await this.getById(request.reviewId);
			const latestChangesetContainingFile = review.reviewChangesets
				.slice()
				.reverse()
				.find(
					c =>
						c.repoId === request.repoId &&
						c.modifiedFilesInCheckpoint.find(mf => mf.file === request.path)
				);
			return this.getContentsForCheckpoint(
				reviewId,
				repoId,
				latestChangesetContainingFile!.checkpoint,
				path
			);
		} else if (checkpoint === 0) {
			return this.getContentsForCheckpoint(reviewId, repoId, 0, path);
		} else {
			const atPriorCheckpoint = (
				await this.getContentsForCheckpoint(reviewId, repoId, checkpoint - 1, path)
			).right;
			const atRequestedCheckpoint = (
				await this.getContentsForCheckpoint(reviewId, repoId, checkpoint, path)
			).right;
			return {
				left: atPriorCheckpoint,
				right: atRequestedCheckpoint
			};
		}
	}

	async getContentsForCheckpoint(
		reviewId: string,
		repoId: string,
		checkpoint: CSReviewCheckpoint,
		filePath: string
	): Promise<GetReviewContentsResponse> {
		const { git } = SessionContainer.instance();
		const review = await this.getById(reviewId);
		const changeset = review.reviewChangesets.find(
			c => c.repoId === repoId && c.checkpoint === checkpoint
		);
		if (!changeset) throw new Error(`Could not find changeset with repoId ${repoId}`);
		const fileInfo = changeset.modifiedFiles.find(f => f.file === filePath);
		if (!fileInfo) throw new Error(`Could not find changeset file information for ${filePath}`);

		const diffs = await this.getDiffs(reviewId, repoId);
		const checkpointDiff = diffs.find(d => d.checkpoint === changeset.checkpoint)!;
		const diff = checkpointDiff.diff;
		const leftDiff = diff.leftDiffs.find(
			d => d.newFileName === fileInfo.oldFile || d.oldFileName === fileInfo.oldFile
		);
		const leftBaseRelativePath = (leftDiff && leftDiff.oldFileName) || fileInfo.oldFile;
		const rightDiff = diff.rightDiffs?.find(
			d => d.newFileName === fileInfo.file || d.oldFileName === fileInfo.file
		);
		const rightBaseRelativePath = (rightDiff && rightDiff.oldFileName) || fileInfo.file;

		const repo = await git.getRepositoryById(repoId);
		if (!repo) {
			throw new Error(`Could not load repo with ID ${repoId}`);
		}

		const leftBasePath = path.join(repo.path, leftBaseRelativePath);
		const rightBasePath = path.join(repo.path, rightBaseRelativePath);

		const isNewFile =
			fileInfo.statusX === FileStatus.added || fileInfo.statusX === FileStatus.untracked;
		const leftBaseContents = isNewFile
			? ""
			: (await git.getFileContentForRevision(leftBasePath, diff.leftBaseSha)) || "";
		const normalizedLeftBaseContents = Strings.normalizeFileContents(leftBaseContents);
		const leftContents =
			leftDiff !== undefined
				? applyPatch(normalizedLeftBaseContents, leftDiff)
				: normalizedLeftBaseContents;
		const rightBaseContents = isNewFile
			? ""
			: diff.leftBaseSha === diff.rightBaseSha
			? leftBaseContents
			: (await git.getFileContentForRevision(rightBasePath, diff.rightBaseSha)) || "";
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
		let isAmending = false;
		let reviewChangesets: CSTransformedReviewChangeset[] = [];
		if (request.repoChanges && request.repoChanges.length) {
			isAmending = true;
			const { posts } = SessionContainer.instance();
			reviewChangesets = (await Promise.all(
				request.repoChanges
					.map(rc => posts.buildChangeset(rc, request.id))
					.filter(_ => _ !== undefined)
			)) as CSTransformedReviewChangeset[];
			request.$addToSet = {
				reviewChangesets: reviewChangesets
			};
			this._diffs.delete(request.id);
			delete request.repoChanges;
		}

		const updateResponse = await this.session.api.updateReview(request);
		const [review] = await this.resolve({
			type: MessageType.Reviews,
			data: [updateResponse.review]
		});

		if (isAmending && reviewChangesets.length) {
			this.trackReviewCheckpointCreation(request.id, reviewChangesets);
		}

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
			for (const d of diffs) {
				let leftCommit = await git.getCommit(repoPath, d.diff.leftBaseSha);
				let rightCommit = await git.getCommit(repoPath, d.diff.rightBaseSha);
				if (leftCommit == null || rightCommit == null) {
					const didFetch = await git.fetchAllRemotes(repoPath);
					if (didFetch) {
						leftCommit = leftCommit || (await git.getCommit(repoPath, d.diff.leftBaseSha));
						rightCommit = rightCommit || (await git.getCommit(repoPath, d.diff.rightBaseSha));
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
					return missingCommitError(d.diff.leftBaseSha, d.diff.leftBaseAuthor);
				}
				if (rightCommit == null) {
					return missingCommitError(d.diff.rightBaseSha, d.diff.rightBaseAuthor);
				}
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

	private trackReviewCheckpointCreation(
		reviewId: string,
		reviewChangesets: CSTransformedReviewChangeset[]
	) {
		process.nextTick(() => {
			try {
				const telemetry = Container.instance().telemetry;
				const totalCheckpoints =
					reviewChangesets.map(_ => _!.checkpoint || 0).sort((a, b) => (b || 0) - (a || 0))[0] + 1;
				const reviewProperties: {
					[key: string]: any;
				} = {
					"Review ID": reviewId,
					"Checkpoint Total": totalCheckpoints,
					"Files Added": reviewChangesets
						.map(_ => _.modifiedFiles.length)
						.reduce((acc, x) => acc + x),
					"Pushed Commits Added": reviewChangesets
						.map(_ => _.commits.filter(c => !c.localOnly).length)
						.reduce((acc, x) => acc + x),
					"Local Commits Added": reviewChangesets
						.map(_ => _.commits.filter(c => c.localOnly).length)
						.reduce((acc, x) => acc + x),
					"Staged Changes Added": reviewChangesets.some(_ => _.includeStaged),
					"Saved Changes Added": reviewChangesets.some(_ => _.includeSaved)
				};

				telemetry.track({
					eventName: "Checkpoint Added",
					properties: reviewProperties
				});
			} catch (ex) {
				Logger.error(ex);
			}
		});
	}
	/**
	 * Sets any undefined checkpoint properties to 0.
	 * Used with legacy reviews.
	 * @param  {CSReview} review
	 */
	private polyfillCheckpoints(review: CSReview) {
		if (review && review.reviewChangesets && review.reviewChangesets.length) {
			for (const rc of review.reviewChangesets) {
				if (rc.checkpoint === undefined) {
					rc.checkpoint = 0;
				}
			}
		}
	}

	protected async loadCache() {
		const response = await this.session.api.fetchReviews({});
		response.reviews.forEach(this.polyfillCheckpoints);
		this.cache.reset(response.reviews);
	}

	protected async fetchById(reviewId: Id): Promise<CSReview> {
		const response = await this.session.api.getReview({ reviewId });
		this.polyfillCheckpoints(response.review);
		return response.review;
	}

	protected getEntityName(): string {
		return "Review";
	}
}
