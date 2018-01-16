'use strict';

import GitCommit from './GitCommit';
import Git from 'nodegit';

function log() {
	console.log.apply(console, arguments);
}

export async function open(path) {
	const git = await Git.Repository.open(path);
	return new GitRepo(git);
}

class DeltaBuilder {

	constructor(cfg) {
		this._oldFile = cfg.oldFile;
		this._newFile = cfg.newFile;
		this._edits = [];
		this._state = 'sync';
		this._oldLine = 0;
		this._newLine = 0;
	}

	processLine(line) {
		const origin = line.origin();
		if (origin === Git.Diff.LINE.CONTEXT) {
			this._ctx(line);
		} else if (origin === Git.Diff.LINE.ADDITION) {
			this._add(line);
		} else if (origin === Git.Diff.LINE.DELETION) {
			this._del(line);
		}
	}

	build() {
		this._setState('sync');

		return {
			oldFile: this._oldFile,
			newFile: this._newFile,
			edits: this._edits
		};
	}

	_ctx(line) {
		this._setState('sync');
		this._oldLine = line.oldLineno();
		this._newLine = line.newLineno();
	}

	_add(line) {
		this._setState('edit');
		this._adds.push(line.content());
	}

	_del(line) {
		this._setState('edit');
		this._dels.push(line.content());
	}

	_setState(state) {
		if (state !== this._state) {
			this._state = state;
			this['_' + state]();
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

	constructor(git) {
		this._git = git;
		this._deltasBetweenCommits = {};
	}

	async getCurrentCommit() {
		const gitCommit = await this._git.getHeadCommit();
		return new GitCommit(gitCommit);
	}

	async getCommit(hash) {
		const gitCommit = await this._git.getCommit(hash);
		return new GitCommit(gitCommit);
	}

	async getDeltasBetweenCommits(oldCommit, newCommit) {
		const cache = this._deltasBetweenCommits;
		const oldCommitDeltas = cache[oldCommit] || (cache[oldCommit] = {});

		let deltas = oldCommitDeltas[newCommit];

		if (!deltas) {
			const oldTree = await oldCommit._gitCommit.getTree();
			const newTree = await newCommit._gitCommit.getTree();
			const diff = await Git.Diff.treeToTree(this._git, oldTree, newTree);
			deltas = oldCommitDeltas[newCommit] = await this._buildDeltasFromDiffs([diff]);
		}

		return deltas;
	}

	async getDeltas(commit) {
		const diffs = await commit._gitCommit.getDiff();
		const deltas = await this._buildDeltasFromDiffs(diffs);
		return deltas;
	}

	async _buildDeltasFromDiffs(diffs) {
		const deltas = [];

		for (const diff of diffs) {
			await diff.findSimilar({
				flags: Git.Diff.FIND.RENAMES
			});
			const patches = await diff.patches();
			for (const patch of patches) {
				const builder = new DeltaBuilder({
					oldFile: patch.oldFile().path(),
					newFile: patch.newFile().path()
				});
				const hunks = await patch.hunks();
				for (const hunk of hunks) {
					const lines = await hunk.lines();
					for (const line of lines) {
						builder.processLine(line);
					}
				}
				deltas.push(builder.build());
			}
		}

		return deltas;
	}

}

export default GitRepo;
