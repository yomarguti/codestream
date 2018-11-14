"use strict";
import {
	CreateRepoRequest,
	CreateRepoRequestType,
	CreateRepoResponse,
	FetchReposRequest,
	FetchReposRequestType,
	FetchReposResponse,
	GetRepoRequest,
	GetRepoRequestType,
	GetRepoResponse
} from "../shared/agent.protocol";
import { CSRepository } from "../shared/api.protocol";
import { lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class ReposManager extends CachedEntityManagerBase<CSRepository> {
	@lspHandler(CreateRepoRequestType)
	createRepo(request: CreateRepoRequest): Promise<CreateRepoResponse> {
		return this.session.api.createRepo(request);
	}

	@lspHandler(FetchReposRequestType)
	async get(request?: FetchReposRequest): Promise<FetchReposResponse> {
		let repos = await this.ensureCached();
		if (request != null) {
			if (request.repoIds != null && request.repoIds.length !== 0) {
				repos = repos.filter(r => request.repoIds!.includes(r.id));
			}
		}

		return { repos: repos };
	}

	protected async loadCache() {
		const response = await this.session.api.fetchRepos({});
		this.cache.set(response.repos);
	}

	protected async fetchById(repoId: Id): Promise<CSRepository> {
		const response = await this.session.api.getRepo({ repoId: repoId });
		return response.repo;
	}

	@lspHandler(GetRepoRequestType)
	private async getRepo(request: GetRepoRequest): Promise<GetRepoResponse> {
		const repo = await this.getById(request.repoId);
		return { repo: repo };
	}
}
