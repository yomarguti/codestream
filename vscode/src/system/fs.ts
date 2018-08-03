"use strict";
import * as fs from "fs";

export namespace FileSystem {
	export function loadJsonFromFile<T>(file: string): Promise<T> {
		return new Promise((resolve, reject) => {
			fs.readFile(file, (err, data) => {
				if (err) {
					reject(err);
					return;
				}

				try {
					resolve(JSON.parse(data.toString("utf8")));
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}
}
