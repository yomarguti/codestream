import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CodeStreamSession } from "session";
import { Logger } from "../logger";
import {
	ReadTextFileRequest,
	ReadTextFileRequestType,
	ReadTextFileResponse,
	WriteTextFileRequest,
	WriteTextFileRequestType,
	WriteTextFileResponse
} from "../protocol/agent.protocol.textFiles";
import { log, lsp, lspHandler } from "../system";

@lsp
export class TextFilesManager {
	constructor(public readonly session: CodeStreamSession) {}

	private textFilePath(file: string): string {
		return path.join(os.homedir(), ".codestream", file);
	}

	@log()
	@lspHandler(ReadTextFileRequestType)
	async readTextFile(request: ReadTextFileRequest): Promise<ReadTextFileResponse> {
		try {
			const file = this.textFilePath(request.path);
			if (!fs.existsSync(file)) return {};
			const contents = fs.readFileSync(file, "utf8");
			Logger.debug(`Read data ${contents} from ${file}`);
			return { contents };
		} catch (ex) {
			Logger.error(ex);
		}
		return {};
	}

	@log()
	@lspHandler(WriteTextFileRequestType)
	async writeTextFile(request: WriteTextFileRequest): Promise<WriteTextFileResponse> {
		const { path, contents } = request;
		try {
			const file = this.textFilePath(path);
			fs.writeFileSync(file, contents);
			Logger.debug(`Saved contents ${contents} to ${file}`);
			return {
				success: true
			};
		} catch (ex) {
			Logger.error(ex);
		}
		return {
			success: false
		};
	}
}
