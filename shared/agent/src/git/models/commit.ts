"use strict";

export class GitCommit {
	public readonly shortMessage: string;

	constructor(
		public readonly repoPath: string,
		public readonly ref: string,
		public readonly author: string,
		public readonly email: string | undefined,
		public readonly authorDate: Date,
		public readonly committerDate: Date,
		public readonly message: string
	) {
		const index = this.message.indexOf("\n");
		this.shortMessage =
			index === -1 ? this.message : `${this.message.substring(0, index)}\u00a0\u2026`;
	}
}
