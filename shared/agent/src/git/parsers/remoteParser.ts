"use strict";
import { GitRemote, GitRemoteType } from "../models/remote";

const remoteRegex = /^(.*)\t(.*)\s\((.*)\)$/gm;
const urlRegex = /^(?:(git:\/\/)(.*?)\/|(https?:\/\/)(?:.*?@)?(.*?)\/|git@(.*):|(ssh:\/\/)(?:.*@)?(.*?)(?::.*?)?\/|(?:.*?@)(.*?):)(.*)$/;

export class GitRemoteParser {
	static parse(data: string, repoPath: string): GitRemote[] {
		if (!data) return [];

		const remotes: GitRemote[] = [];
		const groups = Object.create(null);

		let match: RegExpExecArray | null = null;
		do {
			match = remoteRegex.exec(data);
			if (match == null) break;

			const url = match[2];

			const [scheme, domain, path] = this.parseGitUrl(url);

			const uniqueness = `${domain}/${path}`;
			let remote: GitRemote | undefined = groups[uniqueness];
			if (remote === undefined) {
				remote = new GitRemote(repoPath, match[1], url, scheme, domain, path, [
					{ url: url, type: match[3] as GitRemoteType }
				]);
				remotes.push(remote);
				groups[uniqueness] = remote;
			} else {
				remote.types.push({ url: url, type: match[3] as GitRemoteType });
			}
		} while (match != null);

		if (!remotes.length) return [];

		return remotes;
	}

	static parseGitUrl(url: string): [string, string, string] {
		const match = urlRegex.exec(url);
		if (match == null) return ["", "", ""];

		return [
			match[1] || match[3] || match[6],
			match[2] || match[4] || match[5] || match[7] || match[8],
			match[9].replace(/\.git\/?$/, "")
		];
	}
}
