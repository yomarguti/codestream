"use strict";
import {
	FetchReviewChangesetsRequestType,
	FetchReviewChangesetsRequest,
	FetchReviewChangesetsResponse
} from "../protocol/agent.protocol";
import { CSRepoChangeset } from "../protocol/api.protocol";
import { lsp, lspHandler, log } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class ReviewChangesetsManager extends CachedEntityManagerBase<CSRepoChangeset> {
	@lspHandler(FetchReviewChangesetsRequestType)
	@log()
	async get(request: FetchReviewChangesetsRequest): Promise<FetchReviewChangesetsResponse> {
		return this.session.api.fetchReviewChangesets(request);
	}

	protected async loadCache() {}

	@log()
	protected async fetchById(changesetId: Id): Promise<CSRepoChangeset> {
		const response = await this.session.api.getReviewChangeset({ changesetId });
		return response.changeset;
	}

	protected getEntityName(): string {
		return "ReviewChangeset";
	}
}
