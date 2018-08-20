"use strict";

import * as fs from "fs";
import * as writeAtomic from "write-file-atomic";

export namespace xfs {
	export async function readJson(srcPath: string) {
		return new Promise((resolve, reject) => {
			fs.readFile(srcPath, "utf8", (err, data) => {
				if (err) {
					if (err.code === "ENOENT") {
						resolve(undefined);
					} else {
						reject(err);
					}
				} else {
					resolve(JSON.parse(data.toString()));
				}
			});
		});
	}

	export async function writeJsonAtomic(json: any, destPath: string): Promise<undefined> {
		const data = JSON.stringify(json, null, 2);

		return new Promise<undefined>((resolve, reject) => {
			writeAtomic(destPath, data, err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}
