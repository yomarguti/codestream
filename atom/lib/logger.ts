import { Disposable } from "atom";
import * as fs from "fs-plus";
import * as os from "os";
import * as path from "path";
import { Debug } from "utils";

export const LOG_DIR = path.join(os.tmpdir(), "atom-codestream/logs");

function createDir(uri: string) {
	return new Promise((resolve, reject) => {
		fs.makeTree(uri, error => {
			if (error) reject(error);
			else resolve();
		});
	});
}

function deleteFile(filePath: string) {
	return new Promise((resolve, reject) => {
		fs.unlink(filePath, error => {
			if (error && !error.message.includes("no such file or directory")) {
				reject(error);
			} else resolve();
		});
	});
}

export class FileLogger implements Disposable {
	readonly fileName: string;
	readonly filePath: string;
	private _isReady = false;

	constructor(name: string) {
		this.fileName = `${name}.log`;
		this.filePath = path.join(LOG_DIR, this.fileName);
		this.initialize();
	}

	async initialize() {
		try {
			await createDir(LOG_DIR);
			this._isReady = true;
		} catch (error) {
			if (!Debug.isSilent()) {
				console.error("CodeStream: error creating log folder", error);
			}
		}
	}

	async dispose() {
		try {
			await deleteFile(this.filePath);
		} catch (error) {
			if (!Debug.isSilent()) {
				console.error(`CodeStream: error deleting ${this.fileName}`, error);
			}
		}
	}

	log(type: string, message: string, args: any = "") {
		if (!this._isReady) return;

		fs.appendFile(this.filePath, `[${type}]: ${message} ${args}\n`, error => {
			if (error && Debug.isSilent()) {
				console.error(`CodeStream: failed to write to ${this.fileName}`, error);
			}
		});
	}
}
