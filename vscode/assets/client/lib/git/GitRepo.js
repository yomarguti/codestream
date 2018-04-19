"use strict";

import Remote from "./Remote";
import DeltaBuilder from "./DeltaBuilder";
import git from "../git";
import eol from "eol";
import stripEof from "strip-eof";
import { structuredPatch, parsePatch } from "diff";

const openRepos = {};

export const open = path => {
	return openRepos[path] || (openRepos[path] = new GitRepo(path));
};

const emptyDelta = filePath => {
	return {
		oldFile: filePath,
		newFile: filePath,
		edits: []
	};
};

class GitRepo {
	constructor(path) {
		this._path = path;
	}

	async run(...args) {
		const data = await git(args, {
			cwd: this._path
		});
		return data.trim();
	}

	async getCurrentCommit() {
		return await this.run("rev-parse", "--verify", "HEAD");
	}

	async ensureCommitExists(hash) {
		try {
			const type = await this.run("cat-file", "-t", hash);
			return type === "commit";
		} catch (err) {
			try {
				await this.run("fetch", "--all");
			} catch (err) {
				console.warn(err);
				return false;
			}
			try {
				const type = await this.run("cat-file", "-t", hash);
				return type === "commit";
			} catch (err) {
				return false;
			}
		}
	}

	async getDeltaBetweenCommits(oldCommit, newCommit, filePath) {
		const rawDiff = await this.run("diff", oldCommit, newCommit, "--", filePath);
		if (rawDiff) {
			const patches = parsePatch(rawDiff);
			if (patches.length > 1) {
				console.warn("Parsed diff generated multiple patches");
			}
			return new DeltaBuilder(patches[0]).build();
		} else {
			return emptyDelta(filePath);
		}
	}

	async getDeltaForUncommittedChanges(filePath, text) {
		let committedText = await this.run("show", "HEAD:" + filePath);

		text = stripEof(eol.auto(text));
		committedText = stripEof(eol.auto(committedText));

		const patch = structuredPatch(filePath, filePath, committedText, text);
		return new DeltaBuilder(patch).build();
	}

	async getCommitHistoryForFile(filePath, maxHistorySize) {
		const rawHistory = await this.run(
			"log",
			"--format=format:%H",
			"-n",
			maxHistorySize,
			"--",
			filePath
		);
		return rawHistory.split("\n");
	}

	async listRemoteReferences() {
		return (await this.run("remote", "-v"))
			.split("\n")
			.filter(Boolean)
			.map(line => line.split(/\s+/))
			.map(Remote);
	}

	async isTracked(path) {
		const result = await this.run("ls-files", path);
		return !!result;
	}
}
