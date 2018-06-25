"use strict";

import { Container } from "../container";

export namespace RepoUtil {
	const repoIdsByPath = new Map<string, string>();

	export async function getRepoId(filePath: string): Promise<string | undefined> {
		const { api, config, git } = Container.instance();

		const repoRoot = await git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		let id = repoIdsByPath.get(repoRoot);
		if (!id) {
			const getReposResponse = await api.getRepos(config.token, config.teamId);
			const repos = getReposResponse.repos;

			for (const r of repos) {
				if (git.repoHasRemote(repoRoot, r.normalizedUrl)) {
					id = r.id;
					repoIdsByPath.set(repoRoot, id);
					return id;
				}
			}
		}

		return id;
	}
}
