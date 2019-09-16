"use strict";
import { MessageType } from "../api/apiProvider";
import { MarkerLocation } from "../api/extensions";
import { SlackApiProvider } from "../api/slack/slackApi";
import { Container, SessionContainer } from "../container";
import { Logger } from "../logger";
import {
	CodemarkPlus,
	CreateCodemarkPermalinkRequest,
	CreateCodemarkPermalinkRequestType,
	CreateCodemarkPermalinkResponse,
	CreateCodemarkRequest,
	CreateCodemarkRequestType,
	CreateCodemarkResponse,
	DeleteCodemarkRequest,
	DeleteCodemarkRequestType,
	DeleteCodemarkResponse,
	FetchCodemarksRequest,
	FetchCodemarksRequestType,
	FetchCodemarksResponse,
	GetCodemarkSha1Request,
	GetCodemarkSha1RequestType,
	GetCodemarkSha1Response,
	PinReplyToCodemarkRequest,
	PinReplyToCodemarkRequestType,
	PinReplyToCodemarkResponse,
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
import { log, lsp, lspHandler, Strings } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

@lsp
export class CodemarksManager extends CachedEntityManagerBase<CSCodemark> {
	async cacheSet(entity: CSCodemark, oldEntity?: CSCodemark): Promise<CSCodemark | undefined> {
		if (await this.canSeeCodemark(entity)) {
			return super.cacheSet(entity, oldEntity);
		} else {
			return undefined;
		}
	}

	@lspHandler(CreateCodemarkRequestType)
	create(request: CreateCodemarkRequest): Promise<CreateCodemarkResponse> {
		return this.session.api.createCodemark(request);
	}

	@lspHandler(CreateCodemarkPermalinkRequestType)
	createPermalink(
		request: CreateCodemarkPermalinkRequest
	): Promise<CreateCodemarkPermalinkResponse> {
		return this.session.api.createCodemarkPermalink(request);
	}

	@lspHandler(FetchCodemarksRequestType)
	async get(request: FetchCodemarksRequest): Promise<FetchCodemarksResponse> {
		const codemarks = this.filterLegacyCodemarks(await this.getAllCached());

		const enrichedCodemarks = [];
		for (const codemark of codemarks) {
			if (request.streamId != null && request.streamId !== codemark.streamId) {
				continue;
			}

			if (!(await this.canSeeCodemark(codemark))) {
				continue;
			}

			enrichedCodemarks.push(await this.enrichCodemark(codemark));
		}

		return { codemarks: enrichedCodemarks };
	}

	@lspHandler(GetCodemarkSha1RequestType)
	@log()
	async getCodemarkSha1({ codemarkId }: GetCodemarkSha1Request): Promise<GetCodemarkSha1Response> {
		const cc = Logger.getCorrelationContext();

		const { codemarks, files, markerLocations, scm } = SessionContainer.instance();

		const codemark = await codemarks.getEnrichedCodemarkById(codemarkId);
		if (codemark === undefined) {
			throw new Error(`No codemark could be found for Id(${codemarkId})`);
		}

		if (codemark.markers == null || codemark.markers.length === 0) {
			Logger.warn(cc, `No markers are associated with codemark Id(${codemarkId})`);
			return { codemarkSha1: undefined, documentSha1: undefined };
		}

		if (codemark.fileStreamIds.length === 0) {
			Logger.warn(cc, `No documents are associated with codemark Id(${codemarkId})`);
			return { codemarkSha1: undefined, documentSha1: undefined };
		}

		const fileStreamId = codemark.fileStreamIds[0];
		const uri = await files.getDocumentUri(fileStreamId);
		if (uri === undefined) {
			Logger.warn(cc, `No document could be loaded for codemark Id(${codemarkId})`);
			return { codemarkSha1: undefined, documentSha1: undefined };
		}

		// Get the most up-to-date location for the codemark
		const marker = codemark.markers[0];
		const { locations } = await markerLocations.getCurrentLocations(uri, fileStreamId, [marker]);

		let documentSha1;

		const location = locations[marker.id];
		if (location != null) {
			const range = MarkerLocation.toRange(location);
			const response = await scm.getRangeSha1({ uri: uri, range: range });
			documentSha1 = response.sha1;
		}

		return {
			// Normalize to /n line endings
			codemarkSha1: Strings.sha1(marker.code.replace(/\r\n/g, "\n")),
			documentSha1: documentSha1
		};
	}

	async getIdByPostId(postId: string): Promise<string | undefined> {
		const codemark = this.filterLegacyCodemarks(await this.getAllCached()).find(
			c => c.postId === postId
		);
		return codemark && codemark.id;
	}

	async getEnrichedCodemarkById(codemarkId: string): Promise<CodemarkPlus> {
		return this.enrichCodemark(await this.getById(codemarkId));
	}

	async enrichCodemark(codemark: CSCodemark): Promise<CodemarkPlus> {
		const { markers: markersManager } = SessionContainer.instance();

		const markers = [];
		if (codemark.markerIds != null && codemark.markerIds.length !== 0) {
			for (const markerId of codemark.markerIds) {
				markers.push(await markersManager.getById(markerId));
			}
		}

		return { ...codemark, markers: markers };
	}

	async enrichCodemarks(codemarks: CSCodemark[]): Promise<CodemarkPlus[]> {
		const enrichedCodemarks = [];
		for (const codemark of codemarks) {
			enrichedCodemarks.push(await this.enrichCodemark(codemark));
		}

		return enrichedCodemarks;
	}

	async enrichCodemarksByIds(codemarkIds: string[]): Promise<CodemarkPlus[]> {
		const enrichedCodemarks = [];
		for (const codemarkId of codemarkIds) {
			enrichedCodemarks.push(await this.getEnrichedCodemarkById(codemarkId));
		}

		return enrichedCodemarks;
	}

	private async canSeeCodemark(codemark: CSCodemark): Promise<boolean> {
		if (!codemark.streamId) return true;

		const stream = await SessionContainer.instance().streams.getByIdFromCache(codemark.streamId);
		if (!stream || stream.deactivated || stream.isArchived) {
			return false;
		}

		if (stream.memberIds === undefined) {
			return true;
		}

		return stream.memberIds.includes(this.session.userId);
	}

	@lspHandler(DeleteCodemarkRequestType)
	delete(request: DeleteCodemarkRequest): Promise<DeleteCodemarkResponse> {
		return this.session.api.deleteCodemark(request);
	}

	@lspHandler(UpdateCodemarkRequestType)
	async edit(request: UpdateCodemarkRequest): Promise<UpdateCodemarkResponse> {
		if (request.externalAssignees && request.externalAssignees.length) {
			request.externalAssignees = request.externalAssignees.map(a => ({
				displayName: a.displayName,
				email: a.email
			}));
		}
		const updateResponse = await this.session.api.updateCodemark(request);
		const [codemark] = await this.resolve({
			type: MessageType.Codemarks,
			data: [updateResponse.codemark]
		});
		return { codemark: await this.enrichCodemark(codemark) };
	}

	@lspHandler(SetCodemarkPinnedRequestType)
	setPinned(request: SetCodemarkPinnedRequest): Promise<SetCodemarkPinnedResponse> {
		return this.session.api.setCodemarkPinned(request);
	}

	@lspHandler(PinReplyToCodemarkRequestType)
	pinReply(request: PinReplyToCodemarkRequest): Promise<PinReplyToCodemarkResponse> {
		return this.session.api.pinReplyToCodemark(request);
	}

	@lspHandler(SetCodemarkStatusRequestType)
	async setStatus(request: SetCodemarkStatusRequest): Promise<SetCodemarkStatusResponse> {
		const response = await this.session.api.setCodemarkStatus(request);
		const [codemark] = await this.resolve({
			type: MessageType.Codemarks,
			data: [response.codemark]
		});
		return { codemark: await this.enrichCodemark(codemark) };
	}

	protected async fetchById(id: Id): Promise<CSCodemark> {
		const response = await this.session.api.getCodemark({ codemarkId: id });
		return response.codemark;
	}

	protected async loadCache(): Promise<void> {
		const response = await this.session.api.fetchCodemarks({});

		if (response.markers) {
			const { markers } = SessionContainer.instance();
			for (const marker of response.markers) {
				markers.cacheSet(marker);
			}
		}

		this.cache.reset(response.codemarks);
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
