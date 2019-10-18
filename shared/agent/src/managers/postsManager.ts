"use strict";
import * as fs from "fs";
import { Range, TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { MessageType } from "../api/apiProvider";
import { Marker, MarkerLocation, Ranges } from "../api/extensions";
import { Container, SessionContainer } from "../container";
import { Logger } from "../logger";
import { calculateLocation } from "../markerLocation/calculator";
import {
	CodeDelimiterStyles,
	CreateCodemarkRequest,
	CreateCodemarkRequestMarker,
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequest,
	CreatePostWithMarkerRequestType,
	DeletePostRequest,
	DeletePostRequestType,
	DeletePostResponse,
	EditPostRequest,
	EditPostRequestType,
	EditPostResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesRequestType,
	FetchPostRepliesResponse,
	FetchPostsRequest,
	FetchPostsRequestType,
	FetchPostsResponse,
	GetPostRequest,
	GetPostRequestType,
	GetPostResponse,
	GetPostsRequest,
	GetPostsRequestType,
	MarkPostUnreadRequest,
	MarkPostUnreadRequestType,
	MarkPostUnreadResponse,
	PostPlus,
	ReactToPostRequest,
	ReactToPostRequestType,
	ReactToPostResponse,
	ReportingMessageType
} from "../protocol/agent.protocol";
import {
	CodemarkType,
	CSCreateCodemarkResponse,
	CSMarker,
	CSMarkerLocation,
	CSPost,
	CSReferenceLocation,
	CSStream,
	ProviderType,
	StreamType
} from "../protocol/api.protocol";
import { Arrays, debug, lsp, lspHandler } from "../system";
import { Strings } from "../system/string";
import { BaseIndex, IndexParams, IndexType } from "./cache";
import { getValues, KeyValue } from "./cache/baseCache";
import { EntityCache, EntityCacheCfg } from "./cache/entityCache";
import { EntityManagerBase, Id } from "./entityManager";

export type FetchPostsFn = (request: FetchPostsRequest) => Promise<FetchPostsResponse>;

interface SearchResult {
	index?: number;
	afterIndex?: number;
	outOfRange?: boolean;
}

function search(posts: CSPost[], seq: string | number): SearchResult {
	if (posts.length === 0) {
		return {
			outOfRange: true
		};
	}

	const seqNum = Number(seq);
	let min = 0;
	let max = posts.length - 1;
	let guess: number;

	const minSeqNum = Number(posts[min].seqNum);
	const maxSeqNum = Number(posts[max].seqNum);

	if (seqNum < minSeqNum || seqNum > maxSeqNum) {
		return {
			outOfRange: true
		};
	}

	while (min <= max) {
		guess = Math.floor((min + max) / 2);
		const guessPost = posts[guess];
		if (guessPost.seqNum === seq) {
			return {
				index: guess
			};
		} else {
			const guessSeqNum = Number(guessPost.seqNum);

			if (min === max) {
				if (seqNum > guessSeqNum) {
					return {
						afterIndex: min
					};
				} else {
					return {
						afterIndex: min - 1
					};
				}
			}

			if (guessSeqNum < seqNum) {
				min = guess + 1;
			} else {
				max = guess - 1;
			}
		}
	}

	throw new Error("Unexpected error on PostIndex.search()");
}

class PostCollection {
	private posts: CSPost[];

	constructor(request: FetchPostsRequest, response: FetchPostsResponse) {
		this.posts = response.posts;
		this.updateComplete(request, response);
	}

	private complete = false;
	private updateComplete(request: FetchPostsRequest, response: FetchPostsResponse) {
		if (this.complete) {
			return;
		}

		if (request.after === undefined && !response.more) {
			this.complete = true;
		}
	}

	getBetween(
		after: string | number,
		before: string | number,
		inclusive?: boolean
	): { posts?: CSPost[] } {
		let { index: start } = search(this.posts, after);
		if (start === undefined) {
			return {};
		}

		let { index: end } = search(this.posts, before);
		if (end === undefined) {
			return {};
		}

		if (inclusive) {
			end++;
		} else {
			start++;
		}

		return {
			posts: this.posts.slice(start, end)
		};
	}

	getBefore(
		before: string | number,
		limit: number,
		inclusive?: boolean
	): { posts?: CSPost[]; more?: boolean } {
		let { index: end } = search(this.posts, before);
		if (end === undefined) {
			return {};
		}

		if (inclusive) {
			end++;
		}

		const start = end - limit;
		if (start < 0 && this.complete) {
			return {
				posts: this.posts.slice(0, end),
				more: false
			};
		} else if (start < 0) {
			return {};
		} else {
			return {
				posts: this.posts.slice(start, end),
				more: true
			};
		}
	}

	getAfter(
		after: string | number,
		limit: number,
		inclusive?: boolean
	): { posts?: CSPost[]; more?: boolean } {
		let { index: start } = search(this.posts, after);
		if (start === undefined) {
			return {};
		}

		if (!inclusive) {
			start++;
		}

		const end = start + limit;
		return {
			posts: this.posts.slice(start, end),
			more: end <= this.posts.length
		};
	}

	getLatest(limit: number): { posts: CSPost[]; more: boolean } {
		let start = this.posts.length - limit;
		const more = start > 0 || !this.complete;
		start = Math.max(0, start);

		return {
			posts: this.posts.slice(start),
			more
		};
	}

	get latest() {
		return this.posts[this.posts.length - 1];
	}

	updateOrInsert(post: CSPost) {
		const seqNum = Number(post.seqNum);
		const latestSeqNum = this.latest ? Number(this.latest.seqNum) : 0;
		if (seqNum > latestSeqNum) {
			this.posts.push(post);
		} else {
			const { outOfRange, index, afterIndex } = search(this.posts, post.seqNum);
			if (outOfRange) {
				return;
			} else if (index !== undefined) {
				this.posts[index] = post;
			} else if (afterIndex !== undefined) {
				this.posts.splice(afterIndex + 1, 0, post);
			}
		}
	}

	push(post: CSPost) {
		this.posts.push(post);
	}

	add(request: FetchPostsRequest, response: FetchPostsResponse) {
		const { before, after } = request;
		const { posts } = response;

		if (after) {
			return;
		}

		const firstNewSeq = posts[0].seqNum;
		const lastNewSeq = posts[posts.length - 1].seqNum;
		const firstExistingSeq = this.posts[0].seqNum;

		const firstNewSeqNum = Number(firstNewSeq);
		const lastNewSeqNum = Number(lastNewSeq);
		const firstExistingSeqNum = Number(firstExistingSeq);

		if (before === firstExistingSeq && lastNewSeqNum < firstExistingSeqNum) {
			this.posts = posts.concat(this.posts);
		} else if (firstNewSeqNum < firstExistingSeqNum) {
			const { index } = search(this.posts, lastNewSeq);
			if (index !== undefined) {
				this.posts = posts.concat(this.posts.slice(index + 1));
			}
		}

		this.updateComplete(request, response);
	}
}

export class PostIndex extends BaseIndex<CSPost> {
	private readonly postsByStream = new Map<Id, PostCollection>();

	constructor(fetchFn: FetchPostsFn) {
		super(["streamId"], fetchFn as any);
	}

	invalidate(): void {
		this.postsByStream.clear();
	}

	isStreamInitialized(streamId: Id): boolean {
		return this.postsByStream.has(streamId);
	}

	getPosts(request: FetchPostsRequest): { posts?: CSPost[]; more?: boolean } {
		const { streamId, after, before, limit = 100, inclusive } = request;
		const postCollection = this.postsByStream.get(streamId);
		if (!postCollection) {
			return {};
		}

		if (after !== undefined && before !== undefined) {
			return postCollection.getBetween(after, before, inclusive);
		} else if (after !== undefined) {
			return postCollection.getAfter(after, limit, inclusive);
		} else if (before !== undefined) {
			return postCollection.getBefore(before, limit, inclusive);
		} else {
			return postCollection.getLatest(limit);
		}
	}

	setPosts(request: FetchPostsRequest, response: FetchPostsResponse) {
		if (!this.enabled) return;

		const { streamId } = request;
		let postCollection = this.postsByStream.get(streamId);
		if (!postCollection) {
			postCollection = new PostCollection(request, response);
			this.postsByStream.set(streamId, postCollection);
		} else {
			postCollection.add(request, response);
		}
	}

	set(entity: CSPost, oldEntity?: CSPost): void {
		const streamId = entity.streamId;
		const posts = this.postsByStream.get(streamId);
		if (!posts) {
			return;
		}

		posts.updateOrInsert(entity);
	}
}

interface PostCacheCfg extends EntityCacheCfg<CSPost> {
	fetchPosts: FetchPostsFn;
}

class PostsCache extends EntityCache<CSPost> {
	private readonly postIndex: PostIndex;
	private readonly fetchPosts: FetchPostsFn;

	constructor(cfg: PostCacheCfg) {
		super(cfg);
		this.fetchPosts = cfg.fetchPosts;
		this.postIndex = new PostIndex(cfg.fetchPosts);
		this.indexes.set("streamId", this.postIndex);
	}

	@debug({
		exit: (result: FetchPostsResponse) =>
			`returned ${result.posts.length} posts (more=${result.more})`,
		prefix: (context, request: FetchPostsRequest) => `${context.prefix}(${request.streamId})`,
		singleLine: true
	})
	async getPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const cc = Logger.getCorrelationContext();

		let { posts, more } = this.postIndex.getPosts(request);
		if (posts === undefined) {
			Logger.debug(cc, `cache miss, fetching...`);
			const response = await this.fetchPosts(request);

			this.set(response.posts);

			this.postIndex.setPosts(request, response);
			posts = response.posts;
			more = response.more;
		}

		return { posts: posts!, more };
	}

	private _streamInitialization = new Map<Id, Promise<void>>();
	async ensureStreamInitialized(streamId: Id): Promise<void> {
		if (this.postIndex.isStreamInitialized(streamId)) {
			return;
		}

		const promise = this._streamInitialization.get(streamId);
		if (promise) {
			await promise;
		} else {
			Logger.debug(`PostCache: initializing stream ${streamId}`);
			const newPromise = this.getPosts({
				streamId: streamId,
				limit: 100
			});
			this._streamInitialization.set(streamId, newPromise as Promise<any>);
			await newPromise;
		}
	}
}

function trackPostCreation(request: CreatePostRequest, textDocuments?: TextDocumentIdentifier[]) {
	process.nextTick(() => {
		const { session, streams } = SessionContainer.instance();
		try {
			// Get stream so we can determine type
			streams
				.getById(request.streamId)
				.then(async (stream: CSStream) => {
					let streamType = "Unknown";
					switch (stream.type) {
						case StreamType.Channel:
							stream.privacy === "private"
								? (streamType = "Private Channel")
								: (streamType = "Public Channel");
							break;
						case StreamType.Direct:
							streamType = "Direct Message";
							break;
					}

					let markerType = "Chat";
					const telemetry = Container.instance().telemetry;
					let isMarker = false;
					// Check if it's a marker
					if (request.codemark != null) {
						isMarker = true;
					}

					// Get Type for codemark
					if (request.codemark != null) {
						switch (request.codemark.type) {
							case CodemarkType.Question:
								markerType = "Question";
								break;
							case CodemarkType.Comment:
								markerType = "Comment";
								break;
							case CodemarkType.Trap:
								markerType = "Trap";
								break;
							case CodemarkType.Bookmark:
								markerType = "Bookmark";
								break;
							case CodemarkType.Issue:
								markerType = "Issue";
								break;
							case CodemarkType.Link:
								markerType = "Permalink";
								break;
						}
					}

					const payload: {
						[key: string]: any;
					} = {
						"Stream Type": streamType,
						Type: markerType,
						Thread: request.parentPostId ? "Reply" : "Parent",
						Marker: isMarker
					};
					if (request.entryPoint) {
						payload["Entry Point"] = request.entryPoint;
					}
					if (request.codemark && request.codemark.externalProvider) {
						payload["Linked Service"] = request.codemark.externalProvider;
					}
					// TODO: Add Category
					if (!session.telemetryData.hasCreatedPost) {
						payload["First Post?"] = new Date().toISOString();
						session.telemetryData.hasCreatedPost = true;
					}
					telemetry.track({ eventName: "Post Created", properties: payload });
					if (request.codemark) {
						const { markers = [] } = request.codemark;
						const codemarkProperties: {
							[key: string]: any;
						} = {
							"Codemark Type": request.codemark.type,
							"Linked Service": request.codemark.externalProvider,
							Tags: (request.codemark.tags || []).length,
							Markers: markers.length
						};
						if (textDocuments && textDocuments.length) {
							for (const textDocument of textDocuments) {
								const firstError = await getGitError(textDocument);
								codemarkProperties["Git Error"] = firstError;
								if (firstError) {
									// stop after the first
									break;
								}
							}
						}
						telemetry.track({ eventName: "Codemark Created", properties: codemarkProperties });
					}
				})
				.catch(ex => Logger.error(ex));
		} catch (ex) {
			Logger.error(ex);
		}
	});
}

function getGitError(textDocument?: TextDocumentIdentifier) {
	return new Promise(resolve => {
		if (textDocument) {
			fs.access(URI.parse(textDocument.uri).fsPath, async error => {
				if (error) return resolve("FileNotSaved");

				const scmInfo = await SessionContainer.instance().scm.getFileInfo(textDocument);
				if (!scmInfo.scm) {
					if (!scmInfo.error) {
						return resolve("RepoNotManaged");
					} else {
						return resolve("GitNotFound");
					}
				} else if (scmInfo.scm!.remotes.length === 0) {
					return resolve("NoRemotes");
				}
				resolve();
			});
		}
	});
}

@lsp
export class PostsManager extends EntityManagerBase<CSPost> {
	protected readonly cache: PostsCache = new PostsCache({
		idxFields: this.getIndexedFields(),
		fetchFn: this.fetch.bind(this),
		fetchPosts: this.fetchPosts.bind(this),
		entityName: this.getEntityName()
	});

	disableCache() {
		this.cache.disable();
	}

	enableCache() {
		this.cache.enable();
	}

	async cacheSet(entity: CSPost, oldEntity?: CSPost): Promise<CSPost | undefined> {
		if (entity && entity.streamId) {
			await this.cache.ensureStreamInitialized(entity.streamId);
		}

		return super.cacheSet(entity, oldEntity);
	}

	getIndexedFields(): IndexParams<CSPost>[] {
		return [
			{
				fields: ["streamId", "parentPostId"],
				type: IndexType.Group,
				fetchFn: this.fetchByParentPostId.bind(this)
			}
		];
	}

	protected async fetchById(id: Id): Promise<CSPost> {
		const response = await this.session.api.getPost({ streamId: undefined!, postId: id });
		return response.post;
	}

	private async fetchPosts(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		const response = await this.session.api.fetchPosts(request);
		const container = SessionContainer.instance();
		if (response.codemarks) {
			for (const codemark of response.codemarks) {
				container.codemarks.cacheSet(codemark);
			}
		}
		if (response.markers) {
			for (const marker of response.markers) {
				container.markers.cacheSet(marker);
			}
		}
		return response;
	}

	private async fetchByParentPostId(criteria: KeyValue<CSPost>[]): Promise<CSPost[]> {
		const [streamId, parentPostId] = getValues(criteria);
		const response = await this.session.api.fetchPostReplies({
			streamId,
			postId: parentPostId
		});
		return response.posts;
	}

	@lspHandler(FetchPostsRequestType)
	async get(request: FetchPostsRequest): Promise<FetchPostsResponse> {
		await this.cache.ensureStreamInitialized(request.streamId);
		const cacheResponse = await this.cache.getPosts(request);
		const posts = await this.enrichPosts(cacheResponse.posts);
		const { codemarks } = await SessionContainer.instance().codemarks.get({
			streamId: request.streamId
		});
		return {
			codemarks: codemarks,
			posts: posts,
			more: cacheResponse.more
		};
	}

	@lspHandler(GetPostsRequestType)
	async getPostsByIds(request: GetPostsRequest) {
		return this.session.api.getPosts(request);
	}

	private async enrichPost(post: CSPost): Promise<PostPlus> {
		let codemark;
		let hasMarkers = false;
		if (post.codemarkId) {
			try {
				codemark = await SessionContainer.instance().codemarks.getEnrichedCodemarkById(
					post.codemarkId
				);
				hasMarkers = codemark.markers != null && codemark.markers.length !== 0;
			} catch (ex) {
				Logger.error(ex);
			}
		}

		return { ...post, codemark: codemark, hasMarkers: hasMarkers };
	}

	async enrichPosts(posts: CSPost[]): Promise<PostPlus[]> {
		const enrichedPosts = [];
		for (const post of posts) {
			enrichedPosts.push(await this.enrichPost(post));
		}
		return enrichedPosts;
	}

	@lspHandler(FetchPostRepliesRequestType)
	async getReplies(request: FetchPostRepliesRequest): Promise<FetchPostRepliesResponse> {
		let parentPost;
		let childPosts;

		try {
			parentPost = await this.cache.getById(request.postId);
		} catch (err) {
			Logger.error(err, `Could not find thread's parent post ${request.postId}`);
		}

		try {
			childPosts = await this.cache.getGroup([
				["streamId", request.streamId],
				["parentPostId", request.postId]
			]);
		} catch (err) {
			Logger.error(err, `Could not find thread ${request.postId}`);
		}

		const posts = [];
		if (parentPost) {
			posts.push(parentPost);
		}
		if (childPosts) {
			posts.push(...childPosts);
		}

		const codemarks = await SessionContainer.instance().codemarks.enrichCodemarksByIds(
			Arrays.filterMap(posts, post => post.codemarkId)
		);

		return { posts, codemarks };
	}

	@lspHandler(CreatePostRequestType)
	async createPost(
		request: CreatePostRequest,
		textDocuments?: TextDocumentIdentifier[]
	): Promise<CreatePostResponse> {
		let codemarkResponse: CSCreateCodemarkResponse | undefined;
		let cardResponse;
		let externalProviderUrl;
		let externalProvider;
		let externalProviderHost;
		let externalAssignees;
		let response: CreatePostResponse;
		let providerCardRequest;
		let postId;
		let streamId;
		let requiresUpdate;
		let codemarkId;
		if (this.session.api.providerType !== ProviderType.CodeStream) {
			if (request.codemark) {
				codemarkResponse = await this.session.api.createCodemark({
					...request.codemark,
					parentPostId: request.parentPostId,
					providerType: this.session.api.providerType
				});
				if (request.crossPostIssueValues) {
					providerCardRequest = {
						title: request.codemark.title,
						text: request.codemark.text,
						markers: codemarkResponse.markers,
						permalink: codemarkResponse.codemark.permalink
					};
				}
				codemarkId = codemarkResponse.codemark.id;
				requiresUpdate = true;
			}
		} else {
			// is CS team -- this createPost will create a Post and a Codemark
			response = await this.session.api.createPost(request);
			if (request.codemark) {
				if (request.crossPostIssueValues) {
					providerCardRequest = {
						title: request.codemark.title,
						text: request.codemark.text,
						markers: response.markers,
						permalink: response.codemark && response.codemark.permalink
					};
				}
				codemarkId = response.codemark && response.codemark.id;
			}
		}

		if (providerCardRequest && request.codemark && request.crossPostIssueValues) {
			cardResponse = await this.createProviderCard(
				providerCardRequest,
				request.crossPostIssueValues
			);
			if (cardResponse) {
				externalProviderUrl = cardResponse.url;
				externalProvider = request.crossPostIssueValues.issueProvider.name;
				externalProviderHost = request.crossPostIssueValues.issueProvider.host;
				externalAssignees = request.crossPostIssueValues.assignees;

				request.codemark.externalProviderUrl = externalProviderUrl;
				request.codemark.externalProvider = externalProvider;
				request.codemark.externalAssignees = externalAssignees;
				request.codemark.externalProviderHost = externalProviderHost;
				requiresUpdate = true;
			}
		}

		if (this.session.api.providerType !== ProviderType.CodeStream) {
			response = await this.session.api.createExternalPost({
				...request,
				remotes: request.codemark && request.codemark.remotes,
				codemarkResponse: codemarkResponse
			});
			postId = response.post.id;
			streamId = response.post.streamId;
			requiresUpdate = true;
		}

		if (codemarkId && requiresUpdate) {
			await this.session.api.updateCodemark({
				codemarkId: codemarkId,
				streamId: streamId,
				postId: postId,
				externalProvider: externalProvider,
				externalProviderHost: externalProviderHost,
				externalAssignees:
					externalAssignees &&
					externalAssignees.map((a: any) => ({ displayName: a.displayName, email: a.email })),
				externalProviderUrl: externalProviderUrl
			});
		}

		trackPostCreation(request, textDocuments);
		await resolveCreatePostResponse(response!);
		return {
			...response!,
			post: await this.enrichPost(response!.post)
		};
	}

	@lspHandler(CreatePostWithMarkerRequestType)
	async createPostWithMarker({
		textDocuments,
		text,
		markers,
		streamId,
		parentPostId,
		mentionedUserIds,
		title,
		type,
		assignees,
		color,
		entryPoint,
		status = "open",
		tags,
		relatedCodemarkIds,
		crossPostIssueValues
	}: CreatePostWithMarkerRequest): Promise<CreatePostResponse | undefined> {
		const { documents } = Container.instance();
		const { git, scm } = SessionContainer.instance();

		const codemarkRequest = {
			title,
			text,
			type,
			assignees,
			color,
			status: type === CodemarkType.Issue ? status : undefined,
			tags,
			relatedCodemarkIds,
			markers: []
		} as CreateCodemarkRequest;

		const backtrackedLocations: {
			atDocument: CSMarkerLocation;
			atCurrentCommit: CSMarkerLocation;
			fileContents: string;
			filePath: string;
		}[] = [];

		let index = -1;
		const textDocumentInfo: {
			[key: string]: {
				documentId: TextDocumentIdentifier;
				filePath: string;
				fileContents: string;
			};
		} = {};
		for (const m of markers) {
			index++;
			let marker: CreateCodemarkRequestMarker | undefined;
			let fileCurrentCommit: string | undefined;
			let location: CSMarkerLocation | undefined;
			let locationAtCurrentCommit: CSMarkerLocation | undefined;
			let remotes: string[] | undefined;
			let range: Range | undefined = m.range;
			const source = m.source;

			if (range) {
				Logger.log("createPostWithMarker: creating post with associated range");
				// Ensure range end is >= start
				range = Ranges.ensureStartBeforeEnd(range);
				location = MarkerLocation.fromRange(range);
				let referenceLocations: CSReferenceLocation[] = [];

				if (!textDocumentInfo[m.documentId.uri]) {
					const document = documents.get(m.documentId.uri);
					if (document === undefined) {
						throw new Error(`No document could be found for Uri(${m.documentId.uri})`);
					}
					textDocumentInfo[m.documentId.uri] = {
						documentId: m.documentId,
						filePath: URI.parse(m.documentId.uri).fsPath,
						fileContents: document.getText()
					};
				}
				const { documentId, filePath, fileContents } = textDocumentInfo[m.documentId.uri];

				if (source) {
					Logger.log("createPostWithMarker: source information provided");
					if (source.revision) {
						fileCurrentCommit = source.revision;
						Logger.log(`createPostWithMarker: source revision ${fileCurrentCommit}`);
						locationAtCurrentCommit = await SessionContainer.instance().markerLocations.backtrackLocation(
							documentId,
							fileContents,
							location,
							fileCurrentCommit
						);
						Logger.log(
							`createPostWithMarker: location at current commit ${MarkerLocation.toArray(
								locationAtCurrentCommit
							)}`
						);

						const blameRevisions = await git.getBlameRevisions(filePath, {
							ref: fileCurrentCommit,
							// it expects 0-based ranges
							startLine: locationAtCurrentCommit.lineStart - 1,
							endLine: locationAtCurrentCommit.lineEnd - 1
						});
						Logger.log(
							`createPostWithMarker: backtracking location to ${blameRevisions.length} revisions in the blame of selected range`
						);
						const promises = blameRevisions.map(async (revision, index) => {
							const diff = await git.getDiffBetweenCommits(
								fileCurrentCommit!,
								revision.sha,
								filePath
							);
							const location = await calculateLocation(locationAtCurrentCommit!, diff!);
							const locationArray = MarkerLocation.toArray(location);
							Logger.log(
								`createPostWithMarker: backtracked at ${revision.sha} to ${locationArray}`
							);
							return {
								commitHash: revision.sha,
								location: locationArray,
								flags: {
									backtracked: true
								}
							};
						});

						const meta = locationAtCurrentCommit.meta || {};
						const canonical = !meta.startWasDeleted || !meta.endWasDeleted;
						const referenceLocation = {
							commitHash: fileCurrentCommit,
							location: MarkerLocation.toArray(locationAtCurrentCommit),
							flags: {
								canonical,
								backtracked: !canonical
							}
						};
						const backtrackedLocations = await Promise.all(promises);
						referenceLocations = [referenceLocation, ...backtrackedLocations];
					} else {
						Logger.log(`createPostWithMarker: no source revision - file has no commits`);
						fileCurrentCommit = (await git.getRepoHeadRevision(source.repoPath))!;
						referenceLocations = [
							{
								commitHash: fileCurrentCommit,
								location: MarkerLocation.toArray(MarkerLocation.empty()),
								flags: {
									unversionedFile: true
								}
							}
						];
					}

					backtrackedLocations[index] = {
						atDocument: location,
						atCurrentCommit: locationAtCurrentCommit || MarkerLocation.empty(),
						filePath: filePath,
						fileContents: fileContents
					};

					if (source.remotes && source.remotes.length > 0) {
						remotes = source.remotes.map(r => r.url);
					}
				}

				marker = {
					code: m.code,
					remotes,
					file: source && source.file,
					commitHash: fileCurrentCommit,
					referenceLocations,
					branchWhenCreated: (source && source.branch) || undefined
				};

				codemarkRequest.streamId = streamId;
				if (codemarkRequest.markers) codemarkRequest.markers.push(marker);
				codemarkRequest.remotes = remotes;
				try {
					const scmResponse = await scm.getRangeInfo({
						uri: documentId.uri,
						range: range,
						contents: m.code,
						skipBlame: true
					});

					let remoteCodeUrl;
					if (remotes !== undefined && scmResponse.scm !== undefined && scmResponse.scm.revision) {
						for (const remote of remotes) {
							remoteCodeUrl = Marker.getRemoteCodeUrl(
								remote,
								scmResponse.scm.revision,
								scmResponse.scm.file,
								scmResponse.range.start.line + 1,
								scmResponse.range.end.line + 1
							);

							if (remoteCodeUrl !== undefined) {
								if (!codemarkRequest.remoteCodeUrl) {
									codemarkRequest.remoteCodeUrl = remoteCodeUrl;
								}
								marker.remoteCodeUrl = remoteCodeUrl;
								break;
							}
						}
					}
				} catch (ex) {
					Logger.error(ex);
				}
			}
		}

		try {
			const response = await this.createPost(
				{
					streamId,
					text: "",
					parentPostId,
					codemark: codemarkRequest,
					mentionedUserIds,
					entryPoint,
					crossPostIssueValues
				},
				textDocuments
			);

			const { markers } = response!;
			if (markers && markers.length) {
				markers.forEach((marker, index) => {
					if (backtrackedLocations[index]) {
						const location = backtrackedLocations[index].atDocument;
						const backtrackedLocation = backtrackedLocations[index].atCurrentCommit;
						const filePath = backtrackedLocations[index].filePath;
						const fileContents = backtrackedLocations[index].fileContents;

						const meta = backtrackedLocation.meta;
						if (meta && (meta.startWasDeleted || meta.endWasDeleted)) {
							const uncommittedLocation = {
								...location!,
								id: marker.id
							};

							SessionContainer.instance().markerLocations.saveUncommittedLocation(
								filePath,
								fileContents,
								uncommittedLocation
							);
						}
					}
				});
			}

			response.codemark!.markers = response.markers || [];
			return response;
		} catch (ex) {
			debugger;
			return;
		}
	}

	@lspHandler(DeletePostRequestType)
	deletePost(request: DeletePostRequest): Promise<DeletePostResponse> {
		return this.session.api.deletePost(request);
	}

	@lspHandler(EditPostRequestType)
	editPost(request: EditPostRequest): Promise<EditPostResponse> {
		return this.session.api.editPost(request);
	}

	@lspHandler(MarkPostUnreadRequestType)
	markPostUnread(request: MarkPostUnreadRequest): Promise<MarkPostUnreadResponse> {
		return this.session.api.markPostUnread(request);
	}

	@lspHandler(ReactToPostRequestType)
	reactToPost(request: ReactToPostRequest): Promise<ReactToPostResponse> {
		return this.session.api.reactToPost(request);
	}

	@lspHandler(GetPostRequestType)
	protected async getPost(request: GetPostRequest): Promise<GetPostResponse> {
		const post = await this.getById(request.postId);
		return { post: post };
	}

	protected getEntityName(): string {
		return "Post";
	}

	getCodeDelimiters = (
		codeDelimiterStyle: CodeDelimiterStyles
	): {
		start: string;
		end: string;
		linefeed: string;
		anchorFormat: string;
	} => {
		switch (codeDelimiterStyle) {
			// https://asana.com/guide/help/fundamentals/text
			case CodeDelimiterStyles.NONE:
				return {
					start: "",
					end: "",
					linefeed: "\n",
					anchorFormat: "${text} ${url}"
				};
			// https://docs.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance?view=azure-devops
			case CodeDelimiterStyles.HTML_MARKUP:
				return {
					start: "<pre><div><code>",
					end: "</code></div></pre>",
					linefeed: "<br/>",
					anchorFormat: '<a href="${url}">${text}</a>'
				};

			// https://www.jetbrains.com/help/youtrack/incloud/youtrack-markdown-syntax-issues.html
			case CodeDelimiterStyles.SINGLE_BACK_QUOTE:
				return {
					start: "`",
					end: "`",
					linefeed: "\n",
					anchorFormat: "[${text}](${url})"
				};
			// https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=all
			case CodeDelimiterStyles.CODE_BRACE:
				return {
					start: "{code}",
					end: "{code}",
					linefeed: "\n",
					anchorFormat: "[${text}|${url}]"
				};
			// https://confluence.atlassian.com/bitbucketserver/markdown-syntax-guide-776639995.html
			// https://help.trello.com/article/821-using-markdown-in-trello
			default:
			case CodeDelimiterStyles.TRIPLE_BACK_QUOTE:
				return {
					start: "```\n",
					end: "```\n",
					linefeed: "\n",
					anchorFormat: "[${text}](${url})"
				};
		}
	}

	createProviderCard = async (
		codemark: {
			text: string | undefined;
			title: string | undefined;
			markers?: CSMarker[];
			permalink?: string;
		},
		attributes: any
	) => {
		const delimiters = this.getCodeDelimiters(attributes.codeDelimiterStyle);
		const { linefeed, start, end } = delimiters;
		let description = `${codemark.text}${linefeed}${linefeed}`;
		let createdAtLeastOneLink;
		if (codemark.markers && codemark.markers.length) {
			for (const marker of codemark.markers) {
				description += `In ${marker.file}`;
				let range;
				if (marker.locationWhenCreated) {
					range = MarkerLocation.toRangeFromArray(marker.locationWhenCreated);
				} else if (marker.referenceLocations && marker.referenceLocations.length) {
					const referenceLocation =
						marker.referenceLocations[0] && marker.referenceLocations[0].location;
					if (referenceLocation) {
						range = MarkerLocation.toRangeFromArray(referenceLocation);
					}
				}
				if (range) {
					if (range.start.line === range.end.line) {
						description += ` (Line ${range.start.line + 1})`;
					} else {
						description += ` (Lines ${range.start.line + 1}-${range.end.line + 1})`;
					}
				}

				description += `${linefeed}${linefeed}${start}${linefeed}${marker.code}${linefeed}${end}${linefeed}${linefeed}`;
				if (codemark.permalink) {
					const link = Strings.interpolate(delimiters.anchorFormat, {
						text: "Open on CodeStream",
						url: `${codemark.permalink}?marker=${marker.id}`
					});
					if (link) {
						description += `${link}${linefeed}${linefeed}`;
						createdAtLeastOneLink = true;
					}
				}
			}
		}
		if (!createdAtLeastOneLink) {
			description += `${linefeed}Posted via CodeStream${linefeed}`;
		}

		try {
			let response;
			const { providerRegistry } = SessionContainer.instance();
			switch (attributes.issueProvider.name) {
				case "jira":
				case "jiraserver": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							summary: codemark.title,
							issueType: attributes.issueType,
							project: attributes.boardId,
							assignees: attributes.assignees
						}
					});
					break;
				}
				case "trello": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							listId: attributes.listId,
							name: codemark.title,
							assignees: attributes.assignees,
							description
						}
					});
					break;
				}
				case "github":
				case "github_enterprise": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: codemark.title,
							repoName: attributes.boardName,
							assignees: attributes.assignees
						}
					});
					break;
				}
				case "gitlab": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: codemark.title,
							repoName: attributes.boardName,
							assignee: attributes.assignees[0]
						}
					});
					break;
				}
				case "youtrack": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							name: codemark.title,
							boardId: attributes.board.id,
							assignee: attributes.assignees[0]
						}
					});
					break;
				}
				case "asana": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							boardId: attributes.boardId,
							listId: attributes.listId,
							name: codemark.title,
							assignee: attributes.assignees[0]
						}
					});
					break;
				}
				case "bitbucket": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: codemark.title,
							repoName: attributes.boardName,
							assignee: attributes.assignees[0]
						}
					});
					break;
				}
				case "azuredevops": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: codemark.title,
							boardId: attributes.board.id,
							assignee: attributes.assignees[0]
						}
					});
					break;
				}

				default:
					return undefined;
			}
			return response;
		} catch (error) {
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				message: `Failed to create a ${attributes.issueProvider.name} card`,
				source: "agent",
				extra: { message: error.message }
			});
			Logger.error(error, `failed to create a ${attributes.issueProvider.name} card:`);
			return undefined;
		}
	}
}

async function resolveCreatePostResponse(response: CreatePostResponse) {
	const container = SessionContainer.instance();
	if (response.codemark) {
		await container.codemarks.resolve({
			type: MessageType.Codemarks,
			data: [response.codemark]
		});
	}
	if (response.markers) {
		await container.markers.resolve({
			type: MessageType.Markers,
			data: response.markers
		});
	}
	if (response.markerLocations) {
		await container.markerLocations.resolve({
			type: MessageType.MarkerLocations,
			data: response.markerLocations
		});
	}
	if (response.repos) {
		await container.repos.resolve({
			type: MessageType.Repositories,
			data: response.repos
		});
	}
	if (response.streams) {
		await container.streams.resolve({
			type: MessageType.Streams,
			data: response.streams
		});
	}
}
