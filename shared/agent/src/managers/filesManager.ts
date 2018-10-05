"use strict";
import * as path from "path";
import { TextDocumentIdentifier } from "vscode-languageserver-protocol";
import URI from "vscode-uri";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	FetchFileStreamsRequest,
	FetchFileStreamsRequestType,
	FetchFileStreamsResponse
} from "../shared/agent.protocol";
import { CSFileStream, CSStream, StreamType } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { IndexParams, IndexType } from "./index";
import { EntityManager, Id } from "./managers";

export class FilesManager extends EntityManager<CSFileStream> {
	private idsByPath = new Map<string, Id>();

	protected getIndexedFields(): IndexParams<CSFileStream>[] {
		return [
			{
				fields: ["repoId"],
				type: IndexType.Group,
				fetchFn: this.fetchByRepoId.bind(this)
			}
		];
	}

	// protected init() {
	// 	this.session.onStreamsChanged(this.onStreamsChanged, this);
	// }

	// protected onStreamsChanged(streams: CSStream[]) {
	// 	// const { pubnub, userId } = this.session;
	// 	// TODO Eric help!!!
	// 	// pubnub.subscribe([
	// 	// 	...Iterables.filterMap(
	// 	// 		streams,
	// 	// 		s => (CodeStreamApi.isStreamSubscriptionRequired(s, userId) ? `stream-${s.id}` : undefined)
	// 	// 	)
	// 	// ]);
	// }

	async getByPath(filePath: string): Promise<CSStream | undefined> {
		let id = this.idsByPath.get(filePath);
		if (id) {
			return this.cache.getById(id);
		}

		const container = Container.instance();
		const repo = await container.git.getRepositoryByFilePath(filePath);
		if (repo === undefined || repo.id === undefined) {
			return undefined;
		}

		// @ts-ignore
		const streams = await this.cache.getManyBy("repoId", repo.id);
		for (const stream of streams) {
			this.idsByPath.set(path.join(repo.path, stream.file), stream.id);
		}

		id = this.idsByPath.get(filePath);
		if (id) {
			return this.cache.getById(id);
		}

		return undefined;
	}

	async getByRepoId(repoId: string): Promise<CSFileStream[]> {
		// @ts-ignore
		return this.cache.getManyBy("repoId", repoId);
	}

	async getTextDocument(streamId: string): Promise<TextDocumentIdentifier | undefined> {
		const { git } = Container.instance();

		const stream = await this.cache.getById(streamId);
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

	protected async fetch(id: Id): Promise<CSFileStream> {
		try {
			const response = await Container.instance().api2.getStream({ streamId: id });
			return response.stream as CSFileStream;
		} catch (err) {
			// When the user doesn't have access to the stream, the server returns a 403. If
			// this error occurs, it could be that we're subscribed to streams we're not
			// supposed to be subscribed to.
			Logger.warn(`Error fetching stream id=${id}`);
			return undefined!;
		}
	}

	private async fetchByRepoId(values: any[]): Promise<CSFileStream[]> {
		const [repoId] = values;
		const response = await Container.instance().api2.fetchFileStreams({ repoId: repoId });
		return response.streams as CSFileStream[];
	}

	@lspHandler(FetchFileStreamsRequestType)
	private async fetchFileStreams(
		request: FetchFileStreamsRequest
	): Promise<FetchFileStreamsResponse> {
		const streams = await this.getByRepoId(request.repoId);
		return { streams: streams };
	}
}
