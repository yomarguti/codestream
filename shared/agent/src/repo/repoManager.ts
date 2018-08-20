"use strict";

import { Container } from "../container";

export class RepoManager {
	private static repoIdsByPath = new Map<string, string>();

	static async getRepoId(filePath: string): Promise<string | undefined> {
		const { api, state, git } = Container.instance();

		const repoRoot = await git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		let id = RepoManager.repoIdsByPath.get(repoRoot);
		if (!id) {
			const getReposResponse = await api.getRepos(state.apiToken, state.teamId);
			const repos = getReposResponse.repos;

			for (const repo of repos) {
				for (const r of repo.remotes) {
					if (git.repoHasRemote(repoRoot, r.normalizedUrl)) {
						id = repo.id;
						RepoManager.repoIdsByPath.set(repoRoot, id);
						return id;
					}
				}
			}
		}

		return id;
	}
}
