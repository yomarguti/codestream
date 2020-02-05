"use strict";
import {
	FetchReviewChangesetsRequest,
	FetchReviewChangesetsRequestType,
	FetchReviewChangesetsResponse
} from "../protocol/agent.protocol";
import { CSReviewChangeset } from "../protocol/api.protocol";
import { log, lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class ReviewChangesetsManager extends CachedEntityManagerBase<CSReviewChangeset> {
	@lspHandler(FetchReviewChangesetsRequestType)
	@log()
	async get(request: FetchReviewChangesetsRequest): Promise<FetchReviewChangesetsResponse> {
		return this.session.api.fetchReviewChangesets(request);
	}

	protected async loadCache() {}

	@log()
	protected async fetchById(changesetId: Id): Promise<CSReviewChangeset> {
		const response = await this.session.api.getReviewChangeset({ changesetId });
		return response.changeset;
	}

	protected getEntityName(): string {
		return "ReviewChangeset";
	}
}
