import { FileStatus } from "../../protocol/api.protocol.models";

export interface GitNumStat {
	oldFile: string;
	file: string;
	linesAdded: number;
	linesRemoved: number;
	status: FileStatus;
	statusX: FileStatus;
	statusY: FileStatus;
}
