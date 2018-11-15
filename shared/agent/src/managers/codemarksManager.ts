"use strict";

import { MessageType } from "../api/apiProvider";
import { Container } from "../container";
import {
	CSFullCodemark,
	DidChangeDocumentMarkersNotificationType,
	FetchCodemarksRequest,
	FetchCodemarksRequestType,
	FetchCodemarksResponse,
	UpdateCodemarkRequest,
	UpdateCodemarkRequestType,
	UpdateCodemarkResponse
} from "../shared/agent.protocol.markers";
import { CSCodemark } from "../shared/api.protocol.models";
import { lsp, lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class CodemarksManager extends CachedEntityManagerBase<CSCodemark> {
	initialize() {
		this.session.onDidChangeCodemarks(async (codemarks: CSCodemark[]) => {
			const { files } = Container.instance();
			const fileStreamIds = new Set<Id>();

			for (const codemark of codemarks) {
				if (codemark.fileStreamIds) {
					for (const fileStreamId of codemark.fileStreamIds) {
						fileStreamIds.add(fileStreamId);
					}
				}
			}

			for (const fileStreamId of fileStreamIds) {
				const uri = await files.getDocumentUri(fileStreamId);
				if (uri) {
					this.session.agent.sendNotification(DidChangeDocumentMarkersNotificationType, {
						textDocument: {
							uri
						}
					});
				}
			}
		});
	}

	@lspHandler(FetchCodemarksRequestType)
	async get(request: FetchCodemarksRequest): Promise<FetchCodemarksResponse> {
		const csCodemarks = await this.ensureCached();
		const fullCodemarks = [];

		for (const csCodemark of csCodemarks) {
			if (request.streamId && request.streamId !== csCodemark.streamId) {
				continue;
			}

			const fullCodemark = {
				...csCodemark
			} as CSFullCodemark;
			if (csCodemark.markerIds) {
				fullCodemark.markers = [];
				for (const markerId of csCodemark.markerIds) {
					fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
				}
			}
			fullCodemarks.push(fullCodemark);
		}

		return { codemarks: fullCodemarks };
	}

	@lspHandler(UpdateCodemarkRequestType)
	async edit(request: UpdateCodemarkRequest): Promise<UpdateCodemarkResponse> {
		const updateResponse = await this.session.api.updateCodemark(request);
		const [codemark] = await this.resolve({
			type: MessageType.Codemarks,
			data: [updateResponse.codemark]
		});
		return { codemark: await this.fullCodemark(codemark) };
	}

	protected async fetchById(id: Id): Promise<CSCodemark> {
		const response = await this.session.api.getCodemark({ codemarkId: id });
		return response.codemark;
	}

	protected async loadCache(): Promise<void> {
		const response = await this.session.api.fetchCodemarks({});

		if (response.markers) {
			for (const marker of response.markers) {
				Container.instance().markers.cacheSet(marker);
			}
		}

		this.cache.set(response.codemarks);
	}

	private async fullCodemark(codemark: CSCodemark) {
		let fullCodemark: CSFullCodemark = { ...codemark };
		if (codemark.markerIds) {
			fullCodemark = { ...codemark, markers: [] };
			for (const markerId of codemark.markerIds) {
				const marker = await Container.instance().markers.getById(markerId);
				fullCodemark.markers!.push(marker);
			}
		}
		return fullCodemark;
	}

	protected getEntityName(): string {
		return "Codemark";
	}
}
