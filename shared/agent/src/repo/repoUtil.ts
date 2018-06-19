"use strict";

import { Container } from "../container";

export namespace RepoUtil {
	const repoIdsByPath = new Map<string, string>();

	export async function getRepoId(filePath: string): Promise<string | undefined> {
		const ctx = Container.instance;

		const repoRoot = await ctx.git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		let id = repoIdsByPath.get(repoRoot);
		if (!id) {
			const getReposResponse = await ctx.api.getRepos(ctx.config.token, ctx.config.teamId);
			const repos = getReposResponse.repos;

			for (const r of repos) {
				if (ctx.git.repoHasRemote(repoRoot, r.normalizedUrl)) {
					id = r.id;
					repoIdsByPath.set(repoRoot, id);
					return id;
				}
			}
		}

		return undefined;
	}
}
