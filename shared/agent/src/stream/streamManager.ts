"use strict";
import * as path from "path";
import { CSFileStream, CSStream } from "../api/api";
import { Container } from "../container";
import { GitRepository } from "../git/models/repository";
import { StreamType } from "../shared/api.protocol";
import { Strings } from "../system";
import { TextDocumentIdentifier } from "vscode-languageserver-protocol";
import URI from "vscode-uri";

type StreamsByPath = Map<string, CSFileStream>;
type StreamsByRepoId = Map<string, StreamsByPath>;
type StreamsById = Map<string, CSStream>;

export class StreamManager {
	private static streamsByRepoId: StreamsByRepoId = new Map();
	private static streamsById: StreamsById = new Map();

	static async cacheStreams(streams: CSStream[]) {
		for (const stream of streams) {
			if (stream.type === StreamType.File) {
				const streamsByPath = await StreamManager.getStreamsByRepo(stream.repoId);
				streamsByPath.set(stream.file, stream);
			}
			StreamManager.streamsById.set(stream.id, stream);
		}
	}

	static async getStreamId(filePath: string): Promise<string | undefined> {
		const container = Container.instance();
		const repo = await container.git.getRepositoryByFilePath(filePath);
		if (repo === undefined || repo.id === undefined) return undefined;

		// TODO: Why not lookup streams by absolute path?
		const streamsByPath = await StreamManager.getStreamsByRepo(repo);
		const relPath = Strings.normalizePath(path.relative(repo.path, filePath));
		const stream = streamsByPath.get(relPath);

		return stream && stream.id;
	}

	static async getTextDocument(streamId: string): Promise<TextDocumentIdentifier | undefined> {
		const { git } = Container.instance();

		const stream = await StreamManager.getStream(streamId);
		if (stream.type !== StreamType.File) {
			return undefined;
		}

		const repo = await git.getRepositoryById(stream.repoId);
		if (!repo) {
			return undefined;
		}

		const filePath = path.join(repo.path, stream.file);
		const documentUri = URI.file(filePath).toString();

		return TextDocumentIdentifier.create(documentUri);
	}

	static async getStream(streamId: string): Promise<CSStream> {
		let stream = StreamManager.streamsById.get(streamId);
		if (!stream) {
			const { api, session } = Container.instance();
			const response = await api.getStream(session.apiToken, session.teamId, streamId);
			stream = response.stream;
			await StreamManager.cacheStreams([stream]);
		}
		return stream;
	}

	static async getStreamsByRepo(repoId: string): Promise<StreamsByPath>;
	static async getStreamsByRepo(repo: GitRepository): Promise<StreamsByPath>;
	static async getStreamsByRepo(repoOrId: GitRepository | string): Promise<StreamsByPath> {
		let repo;
		let streamByPathMap;
		if (typeof repoOrId === "string") {
			streamByPathMap = StreamManager.streamsByRepoId.get(repoOrId);
			if (streamByPathMap !== undefined) return streamByPathMap;

			repo = await Container.instance().git.getRepositoryById(repoOrId);
			if (repo === undefined || repo.id === undefined) return new Map();
		} else {
			repo = repoOrId;
			if (repo.id === undefined) return new Map();

			streamByPathMap = StreamManager.streamsByRepoId.get(repo.id);
			if (streamByPathMap !== undefined) return streamByPathMap;
		}

		// TODO: Why not cache the streams by absolute path for faster lookups?
		const streams = await repo.getStreams();
		streamByPathMap = new Map(streams.map<[string, CSFileStream]>(s => [s.file, s]));
		StreamManager.streamsByRepoId.set(repo.id, streamByPathMap);
		for (const stream of streams) {
			StreamManager.streamsById.set(stream.id, stream);
		}

		return streamByPathMap;
	}
}
