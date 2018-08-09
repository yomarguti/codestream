"use strict";

import { Container } from "../container";

export namespace RepoUtil {
	const repoIdsByPath = new Map<string, string>();

	export async function getRepoId(filePath: string): Promise<string | undefined> {
		const { api, state, git } = Container.instance();

		const repoRoot = await git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		let id = repoIdsByPath.get(repoRoot);
		if (!id) {
			const getReposResponse = await api.getRepos(state.apiToken, state.teamId);
			const repos = getReposResponse.repos;

			for (const repo of repos) {
				for (const r of repo.remotes) {
					if (git.repoHasRemote(repoRoot, r.normalizedUrl)) {
						id = repo.id;
						repoIdsByPath.set(repoRoot, id);
						return id;
					}
				}
			}
		}

		return id;
	}
}
