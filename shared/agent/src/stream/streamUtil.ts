"use strict";
import * as path from "path";
import { CSFileStream } from "../api/api";
import { Container } from "../container";
import { GitRepository } from "../git/models/repository";
import { Strings } from "../system";

type StreamsByPath = Map<string, CSFileStream>;
type StreamsByRepoId = Map<string, StreamsByPath>;

export namespace StreamUtil {
	const streamsByRepoId: StreamsByRepoId = new Map();

	export async function getStreamId(filePath: string): Promise<string | undefined> {
		const container = Container.instance();
		const repo = await container.git.getRepositoryByFilePath(filePath);
		if (repo === undefined || repo.id === undefined) return undefined;

		// TODO: Why not lookup streams by absolute path?
		const streamsByPath = await getStreamsByRepo(repo);
		const relPath = Strings.normalizePath(path.relative(repo.path, filePath));
		const stream = streamsByPath.get(relPath);

		return stream && stream.id;
	}

	async function getStreamsByRepo(repoId: string): Promise<StreamsByPath>;
	async function getStreamsByRepo(repo: GitRepository): Promise<StreamsByPath>;
	async function getStreamsByRepo(repoOrId: GitRepository | string): Promise<StreamsByPath> {
		let repo;
		let streamByPathMap;
		if (typeof repoOrId === "string") {
			streamByPathMap = streamsByRepoId.get(repoOrId);
			if (streamByPathMap !== undefined) return streamByPathMap;

			repo = await Container.instance().git.getRepositoryById(repoOrId);
			if (repo === undefined || repo.id === undefined) return new Map();
		} else {
			repo = repoOrId;
			if (repo.id === undefined) return new Map();

			streamByPathMap = streamsByRepoId.get(repo.id);
			if (streamByPathMap !== undefined) return streamByPathMap;
		}

		// TODO: Why not cache the streams by absolute path for faster lookups?
		const streams = await repo.getStreams();
		streamByPathMap = new Map(streams.map<[string, CSFileStream]>(s => [s.file, s]));
		streamsByRepoId.set(repo.id, streamByPathMap);

		return streamByPathMap;
	}
}
