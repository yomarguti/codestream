"use strict";

import { Container } from "../container";
import * as path from "path";
import { RepoUtil } from "../repo/repoUtil";
import { CSFileStream } from "../api/types";

type StreamsByPath = Map<string, CSFileStream>;
type StreamsByRepoId = Map<string, StreamsByPath>;

export namespace StreamUtil {
	const streamsByRepoId: StreamsByRepoId = new Map();

	export async function getStreamId(filePath: string): Promise<string | undefined> {
		const container = Container.instance();
		const repoRoot = await container.git.getRepoRoot(filePath);
		if (!repoRoot) {
			return;
		}

		const repoId = await RepoUtil.getRepoId(filePath);
		if (!repoId) {
			return;
		}

		const streamsByPath = await getStreamsByRepoId(repoId);
		const relPath = path.relative(repoRoot, filePath);
		const stream = streamsByPath.get(relPath);

		return stream && stream.id;
	}

	async function getStreamsByRepoId(repoId: string): Promise<StreamsByPath> {
		const { api, config } = Container.instance();
		let streams = streamsByRepoId.get(repoId);
		if (!streams) {
			streams = new Map();
			const response = await api.getStreams(config.token, config.teamId, repoId);
			for (const stream of response.streams) {
				const fileStream = stream as CSFileStream;
				streams.set(fileStream.file, fileStream);
			}
			streamsByRepoId.set(repoId, streams);
		}
		return streams;
	}
}
