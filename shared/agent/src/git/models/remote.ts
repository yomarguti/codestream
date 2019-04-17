import GitUrlParse from "git-url-parse";
import URI from "vscode-uri";

"use strict";

export enum GitRemoteType {
	Fetch = "fetch",
	Push = "push"
}

export class GitRemote {
	readonly uri: URI;
	readonly normalizedUrl: string;

	constructor(
		public readonly repoPath: string,
		public readonly name: string,
		url: string,
		public readonly scheme: string,
		public readonly domain: string,
		public readonly path: string,
		public readonly types: { type: GitRemoteType; url: string }[]
	) {
		// this matches how the api server normalizes git urls...
		this.uri = URI.parse(scheme ? url : `ssh://${url}`);
		url = url.toLowerCase();

		// gitUrlParse doesn't handle urls without a protocol very well, so
		// just to get it to work, we'll add a protocol if needed
		if (!this.uri.scheme) {
			url = "ssh://" + url;
		}
		const info = GitUrlParse(url);
		// remove trailing .git as needed
		const gitMatch = info.pathname.match(/(.*)\.git$/);
		if (gitMatch) {
			info.pathname = gitMatch[1];
		}
		if (info.pathname.indexOf("/:") === 0) {
			info.pathname = info.pathname.replace("/:", "/");
		}
		this.normalizedUrl = `${info.resource}${info.pathname}`;
	}
}
