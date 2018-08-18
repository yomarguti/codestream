"use strict";

import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { MarkerLocationUtil } from "./markerLocationUtil";

export enum RepoEvents {
	commitHashChanged
}

export class RepoMonitor extends EventEmitter {
	// private interval = 5 * 1000;

	private repos: {
		[repoRoot: string]: { lastCommitHash: string };
	} = {};

	monitor(repoRoot: string) {
		if (!repoRoot.endsWith(".git")) {
			repoRoot = path.join(repoRoot, ".git");
		}
		repoRoot = path.normalize(repoRoot);

		if (this.repos[repoRoot]) {
			return;
		}

		const logFile = path.join(repoRoot, "logs", "HEAD");
		// fs.watch(logFile, (event: string, filename: string) => {
		fs.watch(logFile, () => {
			this.emit("commitHashChanged");
			// MarkerLocationUtil.commitHashChanged();
		});
	}

	// onCommitHashChanged();
}
