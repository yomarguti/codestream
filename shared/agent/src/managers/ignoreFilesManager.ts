import * as fs from "fs";
import * as path from "path";
import { CodeStreamSession } from "session";
import { Logger } from "../logger";
import {
	AddIgnoreFileRequest,
	AddIgnoreFileResponse,
	AddIgnoreFilesRequestType,
	IgnoreFilesRequest,
	IgnoreFilesRequestType,
	IgnoreFilesResponse
} from "../protocol/agent.protocol.repos";
import { log, lsp, lspHandler } from "../system";

@lsp
export class IgnoreFilesManager {
	constructor(public readonly session: CodeStreamSession) {}

	@log()
	@lspHandler(IgnoreFilesRequestType)
	async getIgnoreFiles(request: IgnoreFilesRequest): Promise<IgnoreFilesResponse> {
		const { repoPath } = request;
		try {
			if (repoPath && repoPath.length) {
				const ignoreFile = this.ignoreFilePath(repoPath);
				const data = fs.readFileSync(ignoreFile, "utf8");
				Logger.debug(`Read data ${data} to ${ignoreFile}`);
				return { paths: data.trim().split("\n") };
			}
		} catch (ex) {
			Logger.error(ex);
		}
		return {};
	}

	@log()
	@lspHandler(AddIgnoreFilesRequestType)
	async addIgnoreFile(request: AddIgnoreFileRequest): Promise<AddIgnoreFileResponse> {
		const { repoPath, path } = request;
		try {
			if (repoPath && repoPath.length) {
				const ignoreFile = this.ignoreFilePath(repoPath);
				fs.appendFileSync(ignoreFile, path + "\n");
				Logger.debug(`Saved path ${path} to ${ignoreFile}`);
				return {
					success: true
				};
			}
		} catch (ex) {
			Logger.error(ex);
		}
		return {
			success: false
		};
	}

	private ignoreFilePath(repoPath: string): string {
		return path.join(repoPath, ".codestreamignore");
	}
}
