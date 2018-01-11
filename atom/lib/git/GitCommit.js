'use strict';

class GitCommit {

	constructor(gitCommit) {
		this._gitCommit = gitCommit;
	}

	get hash() {
		return this._gitCommit.id().tostrS();
	}

	equals(that) {
		return this.hash === that.hash;
	}

	async getParent() {
		const parents = await this._gitCommit.getParents(1);
		const parent = parents[0];
		return parent & new GitCommit(parent);
	}

}

export default GitCommit;
