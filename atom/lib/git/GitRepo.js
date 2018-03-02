"use strict";

import Remote from "./Remote";
import git from "../git";
import eol from "eol";
import stripEof from "strip-eof";
import { structuredPatch, parsePatch } from "diff";

const openRepos = {};

const OPERATIONS = {
	" ": "SYNC",
	"+": "ADD",
	"-": "DEL"
};

const REMOTE_ORDER = ["origin", "upstream"]; // last is first

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

class DeltaBuilder {
	constructor(patch) {
		this._oldFile = patch.oldFileName;
		this._newFile = patch.newFileName;
		this._hunks = patch.hunks;
		this._edits = [];
		this._state = "sync";
		this._oldLine = 0;
		this._newLine = 0;
	}

	build() {
		this._processHunks();
		this._setState("sync");
		return {
			oldFile: this._oldFile,
			newFile: this._newFile,
			edits: this._edits
		};
	}

	_processHunks() {
		for (const hunk of this._hunks) {
			const { oldStart, newStart, lines } = hunk;
			let oldLine = oldStart;
			let newLine = newStart;
			for (const rawLine of lines) {
				const operation = OPERATIONS[rawLine.charAt(0)];
				const content = rawLine.substr(1);

				this._processLine({
					operation,
					content,
					oldLine,
					newLine
				});

				if (operation === "SYNC" || operation === "ADD") {
					newLine++;
				}
				if (operation === "SYNC" || operation === "DEL") {
					oldLine++;
				}
			}
		}
	}

	_processLine(line) {
		const operation = line.operation;
		switch (operation) {
			case "SYNC":
				return this._ctx(line);
			case "ADD":
				return this._add(line);
			case "DEL":
				return this._del(line);
		}
	}

	_ctx(line) {
		this._setState("sync");
		this._oldLine = line.oldLine;
		this._newLine = line.newLine;
	}

	_add(line) {
		this._setState("edit");
		this._adds.push(line.content);
	}

	_del(line) {
		this._setState("edit");
		this._dels.push(line.content);
	}

	_setState(state) {
		if (state !== this._state) {
			this._state = state;
			this["_" + state]();
		}
	}

	_sync() {
		const dels = this._dels;
		const adds = this._adds;
		const delStart = this._delStart;
		const addStart = this._addStart;
		const delLength = dels.length;
		const addLength = adds.length;

		this._edits.push({
			delStart: delStart,
			addStart: addStart,
			delLength: delLength,
			addLength: addLength,
			dels: dels,
			adds: adds
		});
	}

	_edit() {
		this._delStart = this._oldLine + 1;
		this._addStart = this._newLine + 1;
		this._adds = [];
		this._dels = [];
	}
}

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
				await this.run("fetch", "origin");
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
		let remotes = (await this.run("remote", "-v"))
			.split("\n")
			.map(line => line.split(/\s+/))
			.map(Remote);

		remotes.sort((a, b) => {
			return REMOTE_ORDER.indexOf(b.name) - REMOTE_ORDER.indexOf(a.name);
		});

		for (const remote of remotes) {
			console.log(remote.name);
		}

		return remotes;
	}
}
