"use strict";
import { GitRemote, GitRemoteType } from "../models/remote";

const emptyStr = "";

const remoteRegex = /^(.*)\t(.*)\s\((.*)\)$/gm;
const urlRegex = /^(?:(git:\/\/)(.*?)\/|(https?:\/\/)(?:.*?@)?(.*?)\/|git@(.*):|(ssh:\/\/)(?:.*@)?(.*?)(?::.*?)?(?:\/|(?=~))|(?:.*?@)(.*?):)(.*)$/;

export class GitRemoteParser {
	static parse(data: string, repoPath: string): GitRemote[] {
		if (!data) return [];

		const remotes: GitRemote[] = [];
		const groups = Object.create(null);

		let url: string;
		let scheme: string;
		let domain: string;
		let path: string;
		let uniqueness: string;
		let remote: GitRemote | undefined;
		let match: RegExpExecArray | null = null;
		do {
			match = remoteRegex.exec(data);
			if (match == null) break;

			// Stops excessive memory usage -- https://bugs.chromium.org/p/v8/issues/detail?id=2869
			url = ` ${match[2]}`.substr(1);

			[scheme, domain, path] = this.parseGitUrl(url);

			uniqueness = `${domain}/${path}`;
			remote = groups[uniqueness];
			if (remote === undefined) {
				remote = new GitRemote(
					repoPath,
					// Stops excessive memory usage -- https://bugs.chromium.org/p/v8/issues/detail?id=2869
					` ${match[1]}`.substr(1),
					url,
					scheme,
					domain,
					path,
					// Stops excessive memory usage -- https://bugs.chromium.org/p/v8/issues/detail?id=2869
					[{ url: url, type: ` ${match[3]}`.substr(1) as GitRemoteType }]
				);
				remotes.push(remote);
				groups[uniqueness] = remote;
			} else {
				// Stops excessive memory usage -- https://bugs.chromium.org/p/v8/issues/detail?id=2869
				remote.types.push({ url: url, type: ` ${match[3]}`.substr(1) as GitRemoteType });
			}
		} while (match != null);

		if (!remotes.length) return [];

		return remotes;
	}

	static parseGitUrl(url: string): [string, string, string] {
		const match = urlRegex.exec(url);
		if (match == null) return [emptyStr, emptyStr, emptyStr];

		return [
			match[1] || match[3] || match[6],
			match[2] || match[4] || match[5] || match[7] || match[8],
			match[9].replace(/\.git\/?$/, emptyStr)
		];
	}
}
