"use strict";

import { MessageType } from "../api/apiProvider";
import { SlackApiProvider } from "../api/slack/slackApi";
import { Container } from "../container";
import {
	CodemarkPlus,
	DidChangeDocumentMarkersNotificationType,
	FetchCodemarksRequest,
	FetchCodemarksRequestType,
	FetchCodemarksResponse,
	SetCodemarkPinnedRequest,
	SetCodemarkPinnedRequestType,
	SetCodemarkPinnedResponse,
	SetCodemarkStatusRequest,
	SetCodemarkStatusRequestType,
	SetCodemarkStatusResponse,
	UpdateCodemarkRequest,
	UpdateCodemarkRequestType,
	UpdateCodemarkResponse
} from "../protocol/agent.protocol";
import { CSCodemark } from "../protocol/api.protocol";
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

	async cacheSet(entity: CSCodemark, oldEntity?: CSCodemark): Promise<CSCodemark | undefined> {
		if (await this.canSeeCodemark(entity)) {
			return super.cacheSet(entity, oldEntity);
		} else {
			return undefined;
		}
	}

	@lspHandler(FetchCodemarksRequestType)
	async get(request: FetchCodemarksRequest): Promise<FetchCodemarksResponse> {
		let csCodemarks = await this.getAllCached();
		csCodemarks = await this.filterLegacyCodemarks(csCodemarks);
		const fullCodemarks = [];

		for (const csCodemark of csCodemarks) {
			if (request.streamId && request.streamId !== csCodemark.streamId) {
				continue;
			}

			if (!(await this.canSeeCodemark(csCodemark))) {
				continue;
			}
			const [fullCodemark] = await this.fullCodemarks([csCodemark]);
			fullCodemarks.push(fullCodemark);
		}

		return { codemarks: fullCodemarks };
	}

	async fullCodemarks(codemarks: CSCodemark[]): Promise<CodemarkPlus[]> {
		const fullCodemarks = [];
		for (const codemark of codemarks) {
			const fullCodemark: CodemarkPlus = {
				...codemark
			};
			if (codemark.markerIds) {
				fullCodemark.markers = [];
				for (const markerId of codemark.markerIds) {
					fullCodemark.markers.push(await Container.instance().markers.getById(markerId));
				}
			}
			fullCodemarks.push(fullCodemark);
		}

		return fullCodemarks;
	}

	private async canSeeCodemark(codemark: CSCodemark): Promise<boolean> {
		const stream = await Container.instance().streams.getByIdFromCache(codemark.streamId);
		if (!stream || stream.deactivated || stream.isArchived) {
			return false;
		}

		if (stream.memberIds === undefined) {
			return true;
		}

		return stream.memberIds.includes(this.session.userId);
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

	@lspHandler(SetCodemarkPinnedRequestType)
	setPinned(request: SetCodemarkPinnedRequest): Promise<SetCodemarkPinnedResponse> {
		return this.session.api.setCodemarkPinned(request);
	}

	@lspHandler(SetCodemarkStatusRequestType)
	async setStatus(request: SetCodemarkStatusRequest): Promise<SetCodemarkStatusResponse> {
		const response = await this.session.api.setCodemarkStatus(request);
		const [codemark] = await this.resolve({
			type: MessageType.Codemarks,
			data: [response.codemark]
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
			const { markers } = Container.instance();
			for (const marker of response.markers) {
				markers.cacheSet(marker);
			}
		}

		this.cache.reset(response.codemarks);
	}

	private async fullCodemark(codemark: CSCodemark) {
		let fullCodemark: CodemarkPlus = { ...codemark };
		if (codemark.markerIds) {
			fullCodemark = { ...codemark, markers: [] };
			for (const markerId of codemark.markerIds) {
				const marker = await Container.instance().markers.getById(markerId);
				fullCodemark.markers!.push(marker);
			}
		}
		return fullCodemark;
	}

	// slack only: filter out legacy codemarks with no text that were created by other users
	// and update the current user's legacy codemarks with the text from the slack post if possible
	private filterLegacyCodemarks(codemarks: CSCodemark[]): CSCodemark[] {
		if (!(this.session.api instanceof SlackApiProvider)) return codemarks;

		const result: CSCodemark[] = [];
		const legacyCodemarks: CSCodemark[] = [];

		for (const codemark of codemarks) {
			if (!codemark.type && !codemark.text) {
				if (codemark.creatorId === this.session.codestreamUserId) {
					legacyCodemarks.push(codemark);
					result.push(codemark);
				}
			} else {
				result.push(codemark);
			}
		}
		this.migrate(legacyCodemarks);
		return result;
	}

	private migrate(codemarks: CSCodemark[]) {
		setImmediate(async () => {
			for (const codemark of codemarks) {
				try {
					const { post } = await this.session.api.getPost({
						streamId: codemark.streamId,
						postId: codemark.postId
					});
					this.edit({
						codemarkId: codemark.id,
						text: post.text,
						parentPostId: post.parentPostId
					});
				} catch (ex) {
					/* ignore because we probably couldn't get the slack post */
				}
			}
		});
	}

	protected getEntityName(): string {
		return "Codemark";
	}
}
