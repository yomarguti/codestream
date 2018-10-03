"use strict";
import * as path from "path";
import { TextDocumentIdentifier } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { CSFileStream, CSStream } from "../api/api";
import { StreamType } from "../api/api";
import { Container } from "../container";
import { Strings } from "../system";

type StreamsByFile = Map<string, CSFileStream>;
type StreamsByRepoId = Map<string, StreamsByFile>;
type StreamsById = Map<string, CSStream>;

export class StreamManager {
	private static streamsByRepoId: StreamsByRepoId = new Map();
	private static streamsById: StreamsById = new Map();

	static async cacheStreams(streams: CSStream[]) {
		for (const stream of streams) {
			if (stream.type === StreamType.File) {
				const streamsByFile = await StreamManager.getStreamsByRepo(stream.repoId);
				StreamManager.addOrMergeByFile(streamsByFile, stream);
			}
			StreamManager.addOrMergeById(StreamManager.streamsById, stream);
		}
	}

	static async getStreamId(filePath: string): Promise<string | undefined> {
		const container = Container.instance();
		const repo = await container.git.getRepositoryByFilePath(filePath);
		if (repo === undefined || repo.id === undefined) return undefined;

		// TODO: Why not lookup streams by absolute path?
		const streamsByPath = await StreamManager.getStreamsByRepo(repo.id);
		const relPath = Strings.normalizePath(path.relative(repo.path, filePath));
		const stream = streamsByPath.get(relPath);

		return stream && stream.id;
	}

	static async getTextDocument(streamId: string): Promise<TextDocumentIdentifier | undefined> {
		const { git } = Container.instance();

		const stream = await StreamManager.getStream(streamId);
		if (!stream || stream.type !== StreamType.File) {
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

	static async getStream(streamId: string): Promise<CSStream | undefined> {
		let stream = StreamManager.streamsById.get(streamId);
		if (!stream) {
			const { api, session } = Container.instance();
			try {
				const response = await api.getStream(session.apiToken, session.teamId, streamId);
				stream = response.stream;
				await StreamManager.cacheStreams([stream]);
			} catch (err) {
				// FIXME - when the user doesn't have access to the stream, the server returns a 403
				// there should be a cleaner way to handle it
				return undefined;
			}
		}
		return stream;
	}

	static async getStreamsByRepo(repoId: string): Promise<StreamsByFile> {
		let repoStreams = StreamManager.streamsByRepoId.get(repoId);
		const allStreams = StreamManager.streamsById;

		if (!repoStreams) {
			repoStreams = new Map();
			StreamManager.streamsByRepoId.set(repoId, repoStreams);
			const { api, session } = Container.instance();
			const response = await api.getStreams(session.apiToken, session.teamId, undefined, repoId);
			const streams = response.streams as CSFileStream[];

			for (const stream of streams) {
				repoStreams.set(stream.file, stream);
				allStreams.set(stream.id, stream);
			}
		}

		return repoStreams;
	}

	private static addOrMergeById(streams: StreamsById, stream: CSStream) {
		const existing = streams.get(stream.id);
		if (existing) {
			streams.set(stream.id, {
				...existing,
				...stream
			} as CSStream);
		} else {
			streams.set(stream.id, stream);
		}
	}

	private static addOrMergeByFile(streams: StreamsByFile, stream: CSFileStream) {
		const existing = streams.get(stream.file);
		if (existing) {
			streams.set(stream.file, {
				...existing,
				...stream
			});
		} else {
			streams.set(stream.file, stream);
		}
	}
}
