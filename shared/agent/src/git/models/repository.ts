"use strict";
import * as _path from "path";
import { WorkspaceFolder } from "vscode-languageserver";
import { CSRepository } from "../../api/api";
import { Container } from "../../container";

export class GitRepository {
	readonly normalizedPath: string;

	private readonly _knownRepositorySearchPromise: Promise<CSRepository | undefined>;
	private _knownRepository: CSRepository | undefined;

	constructor(
		public readonly path: string,
		public readonly root: boolean,
		public readonly folder: WorkspaceFolder,
		knownRepos: Map<string, CSRepository>
	) {
		this.normalizedPath = (this.path.endsWith("/") ? this.path : `${this.path}/`).toLowerCase();

		this._knownRepositorySearchPromise = this.searchForKnownRepository(knownRepos);
	}

	async ensureSearchComplete() {
		await this._knownRepositorySearchPromise;
	}

	private async searchForKnownRepository(knownRepos: Map<string, CSRepository>) {
		let found;

		const remotes = await this.getRemotes();
		for (const r of remotes) {
			const repo = knownRepos.get(r.normalizedUrl);
			if (repo !== undefined) {
				found = repo;
				break;
			}
		}

		this._knownRepository = found;
		return this._knownRepository;
	}

	get id() {
		return this._knownRepository !== undefined ? this._knownRepository.id : undefined;
	}

	getRemotes() {
		return Container.instance().git.getRepoRemotes(this.path);
	}
}
