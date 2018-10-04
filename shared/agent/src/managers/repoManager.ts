"use strict";

import { Container } from "../container";
import { CSRepository } from "../shared/api.protocol";
import { EntityManager, Id, IndexedField } from "./managers";

export class RepoManager extends EntityManager<CSRepository> {
	private loaded = false;

	public async getAll(): Promise<CSRepository[]> {
		if (!this.loaded) {
			const { api, session } = Container.instance();
			const response = await api.getRepos(session.apiToken, session.teamId);
			for (const repo of response.repos) {
				this.cache.set(repo);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	protected async fetch(repoId: Id): Promise<CSRepository> {
		const { api, session } = Container.instance();
		const response = await api.getRepo(session.apiToken, session.teamId, repoId);
		return response.repo;
	}

	protected getIndexedFields(): IndexedField<CSRepository>[] {
		return [];
	}
}
