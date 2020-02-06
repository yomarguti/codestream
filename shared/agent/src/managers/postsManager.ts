"use strict";
import { CodeStreamApiProvider } from "api/codestream/codestreamApi";
import * as fs from "fs";
import { groupBy, last, orderBy } from "lodash-es";
import { Range, TextDocumentIdentifier } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { MessageType } from "../api/apiProvider";
import { Marker, MarkerLocation } from "../api/extensions";
import { Container, SessionContainer } from "../container";
import { Logger } from "../logger";
import {
	CodeDelimiterStyles,
	CodemarkPlus,
	CreateCodemarkRequest,
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequest,
	CreatePostWithMarkerRequestType,
	CreateReviewRequest,
	CreateShareableCodemarkRequest,
	CreateShareableCodemarkRequestType,
	CreateShareableCodemarkResponse,
	CreateShareableReviewRequest,
	CreateShareableReviewRequestType,
	CreateShareableReviewResponse,
	CrossPostIssueValues,
	DeletePostRequest,
	DeletePostRequestType,
	DeletePostResponse,
	EditPostRequest,
	EditPostRequestType,
	EditPostResponse,
	FetchActivityRequest,
	FetchActivityRequestType,
	FetchActivityResponse,
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
	ReportingMessageType,
	ReviewPlus
} from "../protocol/agent.protocol";
import {
	CodemarkType,
	CSChannelStream,
	CSCreateCodemarkResponse,
	CSDirectStream,
	CSMarker,
	CSPost,
	CSReview,
	CSStream,
	isCSReview,
	ProviderType,
	StreamType
} from "../protocol/api.protocol";
import { Arrays, debug, log, lsp, lspHandler } from "../system";
import { Strings } from "../system/string";
import { BaseIndex, IndexParams, IndexType } from "./cache";
import { getValues, KeyValue } from "./cache/baseCache";
import { EntityCache, EntityCacheCfg } from "./cache/entityCache";
import { EntityManagerBase, Id } from "./entityManager";
import { MarkerLocationManager } from "./markerLocationManager";
import { MarkerCreationDescriptor, MarkersManager } from "./markersManager";

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

function trackPostCreation(
	request: CreatePostRequest,
	textDocuments?: TextDocumentIdentifier[],
	codemarkId?: string
) {
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

					if (request.codemark) {
						const { markers = [] } = request.codemark;
						const codemarkProperties: {
							[key: string]: any;
						} = {
							"Codemark ID": codemarkId,
							"Codemark Type": request.codemark.type,
							"Linked Service": request.codemark.externalProvider,
							"Entry Point": request.entryPoint,
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

	@lspHandler(FetchActivityRequestType)
	@log()
	async getActivity(request: FetchActivityRequest): Promise<FetchActivityResponse> {
		const response = await (this.session.api as CodeStreamApiProvider).fetchPosts({
			...request
		});

		const unreads = await SessionContainer.instance().users.getUnreads({});
		const {
			codemarks: codemarksManager,
			markers: markersManager,
			posts: postsManager,
			reviews: reviewsManager
		} = SessionContainer.instance();

		const markers = response.markers ?? [];
		// cache the markers
		if (markers.length > 0) Promise.all(markers.map(marker => markersManager.cacheSet(marker)));

		const posts: PostPlus[] = [];
		// filter out deleted posts and cache valid ones
		for (const post of response.posts) {
			if (!post.deactivated) {
				posts.push(post);
				postsManager.cacheSet(post);
			}
		}

		const codemarks: CodemarkPlus[] = [];
		const reviews: CSReview[] = [];

		const markersByCodemark = groupBy(markers, "codemarkId");

		let records = await Arrays.filterMapAsync(
			[...(response.codemarks ?? []), ...(response.reviews ?? [])],
			async object => {
				if (object.deactivated) return;

				if (isCSReview(object)) {
					reviewsManager.cacheSet(object);
					reviews.push(object);
				} else {
					codemarksManager.cacheSet(object);
					codemarks.push({
						...object,
						markers: markersByCodemark[object.id] || []
					});
				}

				if (unreads.unreads.lastReads[object.streamId]) {
					try {
						const threadResponse = await this.session.api.fetchPostReplies({
							postId: object.postId,
							streamId: object.streamId
						});
						posts.push(...threadResponse.posts);
					} catch (error) {
						debugger;
					}
				}

				return object;
			}
		);

		records = orderBy(records, r => r.lastActivityAt ?? r.createdAt, "desc");

		// if there are no valid activities in this batch, recurse
		if (records.length === 0 && response.posts.length > 0 && response.more) {
			const beforePostId = last(response.posts)!.id;
			return this.getActivity({
				...request,
				before: beforePostId
			});
		}

		return {
			codemarks,
			reviews,
			posts: await this.enrichPosts(posts),
			records: this.createRecords(records),
			more: response.more
		};
	}

	private createRecords(records: (CSReview | CodemarkPlus)[]): string[] {
		return records.map(r => {
			if (isCSReview(r)) {
				return `review|${r.id}`;
			}

			return `codemark|${r.id}`;
		});
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

	// this is what the webview will call to create codemarks in the sharing model
	@lspHandler(CreateShareableCodemarkRequestType)
	async createSharingCodemarkPost(
		request: CreateShareableCodemarkRequest
	): Promise<CreateShareableCodemarkResponse> {
		const codemarkRequest: CreateCodemarkRequest = {
			...request.attributes,
			status:
				request.attributes.type === CodemarkType.Issue ? request.attributes.status : undefined,
			markers: []
		};

		const markerCreationDescriptors: MarkerCreationDescriptor[] = [];
		let codemark: CodemarkPlus | undefined;

		for (const codeBlock of request.attributes.codeBlocks) {
			if (!codeBlock.range) continue;
			const descriptor = await MarkersManager.prepareMarkerCreationDescriptor(
				codeBlock.contents,
				{ uri: codeBlock.uri },
				codeBlock.range,
				codeBlock.scm
			);
			markerCreationDescriptors.push(descriptor);
			codemarkRequest.markers!.push(descriptor.marker);

			if (!codemarkRequest.remoteCodeUrl) {
				codemarkRequest.remoteCodeUrl = descriptor.marker.remoteCodeUrl;
			}
			if (!codemarkRequest.remotes) {
				codemarkRequest.remotes = descriptor.marker.remotes;
			}
		}

		let stream: CSDirectStream | CSChannelStream;

		if (request.memberIds && request.memberIds.length > 0) {
			const response = await SessionContainer.instance().streams.get({
				memberIds: request.memberIds,
				types: [StreamType.Direct]
			});
			if (response.streams.length > 0) {
				stream = response.streams[0] as CSDirectStream;
			} else {
				const response = await SessionContainer.instance().streams.createDirectStream({
					memberIds: request.memberIds,
					type: StreamType.Direct
				});
				stream = response.stream;
			}
		} else {
			stream = await SessionContainer.instance().streams.getTeamStream();
		}

		const response = await this.session.api.createPost({
			codemark: codemarkRequest,
			text: codemarkRequest.text!,
			streamId: stream.id,
			dontSendEmail: !!request.attributes.crossPostIssueValues,
			mentionedUserIds: request.mentionedUserIds
		});

		const { markers } = response!;
		if (markers) {
			Logger.log(`createSharingCodemarkPost: will save uncommitted locations`);
			MarkerLocationManager.saveUncommittedLocations(
				markers,
				markerCreationDescriptors.map(descriptor => descriptor.backtrackedLocation)
			).then(() => {
				Logger.log("Uncommitted locations saved to local cache");
			});
		}

		codemark = response.codemark!;

		if (request.attributes.crossPostIssueValues) {
			const cardResponse = await SessionContainer.instance().posts.createProviderCard(
				{
					codemark: {
						title: codemark.title,
						text: codemark.text,
						markers: response.markers,
						permalink: codemark.permalink
					}
				},
				request.attributes.crossPostIssueValues
			);

			if (cardResponse != undefined) {
				const { assignees, issueProvider } = request.attributes.crossPostIssueValues;
				const r = await this.session.api.updateCodemark({
					codemarkId: codemark.id,
					externalProvider: issueProvider.name,
					externalProviderHost: issueProvider.host,
					externalProviderUrl: cardResponse.url,
					externalAssignees:
						assignees &&
						assignees.map((a: any) => ({ displayName: a.displayName, email: a.email })),
					wantEmailNotification: true
				});
				codemark = r.codemark;
			}
		}

		trackPostCreation(
			{
				streamId: stream.id,
				codemark: codemark,
				text: request.attributes.text!,
				entryPoint: request.entryPoint
			},
			request.textDocuments,
			codemark.id
		);
		await resolveCreatePostResponse(response!);
		return {
			stream,
			markerLocations: response.markerLocations,
			post: await this.enrichPost(response!.post),
			codemark: (codemark as CodemarkPlus).markers
				? codemark
				: await SessionContainer.instance().codemarks.enrichCodemark(codemark)
		};
	}

	// this is what the webview will call to create reviews in the sharing model
	@lspHandler(CreateShareableReviewRequestType)
	async createSharingReviewPost(
		request: CreateShareableReviewRequest
	): Promise<CreateShareableReviewResponse> {
		const reviewRequest: CreateReviewRequest = {
			...request.attributes,
			markers: [],
			reviewChangesets: []
		};

		const { git } = SessionContainer.instance();
		const markerCreationDescriptors: MarkerCreationDescriptor[] = [];
		let review: ReviewPlus | undefined;

		for (const repoChange of request.attributes.repoChanges) {
			const { scm, includeSaved, includeStaged, startCommit, excludedFiles, remotes } = repoChange;
			if (!scm || !scm.repoId || !scm.branch || !scm.commits) continue;

			const modifiedFiles = scm.modifiedFiles.filter(f => !excludedFiles.includes(f.file));

			// filter out only to those commits that were chosen in the review
			const commits = startCommit
				? scm.commits.slice(
						0,
						scm.commits.findIndex(commit => commit.sha === startCommit)
				  )
				: scm.commits;

			// perform a diff against the most recent pushed commit
			const pushedCommit = commits.find(commit => !commit.localOnly);
			// if we have a pushed commit on this branch, use the most recent.
			// otherwise, use the start commit if specified by the user.
			// otherwise, use the parent of the first commit of this branch (the fork point)
			const localDiffSha = pushedCommit
				? pushedCommit.sha
				: startCommit || commits[commits.length - 1].sha + "^";

			// filter out excluded files from the diffs and modified files
			const localDiffs = (
				await git.getDiffs(scm.repoPath, includeSaved, includeStaged, localDiffSha)
			).filter(diff => diff.newFileName && !excludedFiles.includes(diff.newFileName.substr(2)));

			const latestCommitSha = commits[0] ? commits[0].sha : undefined;
			const latestCommitDiffs = latestCommitSha ? (
				await git.getDiffs(scm.repoPath, includeSaved, includeStaged, latestCommitSha)
			).filter(diff => diff.newFileName && !excludedFiles.includes(diff.newFileName.substr(2))) : undefined;

			// WTF typescript, this is defined above
			if (reviewRequest.reviewChangesets) {
				reviewRequest.reviewChangesets.push({
					repoId: scm.repoId,
					branch: scm.branch,
					commits,
					modifiedFiles,
					includeSaved,
					includeStaged,
					remotes,
					diffs: {localDiffSha, localDiffs, latestCommitDiffs },
				});
			}
			for (const patch of localDiffs) {
				const file = patch.newFileName?.substr(2);
				if (file && !excludedFiles.includes(file)) {
					for (const hunk of patch.hunks) {
						const range: Range = {
							start: { line: hunk.newStart, character: 0 },
							end: { line: hunk.newStart + hunk.newLines + 1, character: 0 }
						};

						const descriptor = await MarkersManager.prepareMarkerCreationDescriptor(
							hunk.lines.join("\n"),
							// FIXME -- this isn't the best way to construct this URI
							{ uri: "file://" + scm.repoPath + "/" + file },
							range,
							{
								file,
								repoPath: scm.repoPath,
								revision: "",
								authors: [],
								// FIXME where do we get the remotes?
								remotes,
								branch: scm.branch
							}
						);

						markerCreationDescriptors.push(descriptor);
						reviewRequest.markers!.push(descriptor.marker);

						if (!reviewRequest.remoteCodeUrl) {
							reviewRequest.remoteCodeUrl = descriptor.marker.remoteCodeUrl;
						}
						if (!reviewRequest.remotes) {
							reviewRequest.remotes = descriptor.marker.remotes;
						}
					}
				}
			}
		}

		// FIXME -- not sure if this is the right way to do this
		delete reviewRequest.repoChanges;

		let stream: CSDirectStream | CSChannelStream;

		if (request.memberIds && request.memberIds.length > 0) {
			const response = await SessionContainer.instance().streams.get({
				memberIds: request.memberIds,
				types: [StreamType.Direct]
			});
			if (response.streams.length > 0) {
				stream = response.streams[0] as CSDirectStream;
			} else {
				const response = await SessionContainer.instance().streams.createDirectStream({
					memberIds: request.memberIds,
					type: StreamType.Direct
				});
				stream = response.stream;
			}
		} else {
			stream = await SessionContainer.instance().streams.getTeamStream();
		}

		const response = await this.session.api.createPost({
			review: reviewRequest,
			text: reviewRequest.title!,
			streamId: stream.id,
			dontSendEmail: false,
			mentionedUserIds: request.mentionedUserIds
		});

		review = response.review!;

		// FIXME
		// trackPostCreation(
		// 	{
		// 		streamId: stream.id,
		// 		review,
		// 		title: request.attributes.title!,
		// 		entryPoint: request.entryPoint
		// 	},
		// 	request.textDocuments,
		// 	review.id
		// );
		await resolveCreatePostResponse(response!);
		return {
			stream,
			post: await this.enrichPost(response!.post),
			review
		};
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
		let response: CreatePostResponse | undefined;
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
						codemark: {
							title: request.codemark.title,
							text: request.codemark.text,
							markers: codemarkResponse.markers,
							permalink: codemarkResponse.codemark.permalink
						},
						remotes: request.codemark.remotes
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
						codemark: {
							title: request.codemark.title,
							text: request.codemark.text,
							markers: response.markers,
							permalink: response.codemark && response.codemark.permalink
						},
						remotes: request.codemark.remotes
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
				if (codemarkResponse && codemarkResponse.codemark) {
					codemarkResponse.codemark.externalProviderUrl = externalProviderUrl;
					codemarkResponse.codemark.externalProvider = externalProvider;
					codemarkResponse.codemark.externalAssignees = externalAssignees;
					codemarkResponse.codemark.externalProviderHost = externalProviderHost;
				}
				if (response && response.codemark) {
					response.codemark.externalProviderUrl = externalProviderUrl;
					response.codemark.externalProvider = externalProvider;
					response.codemark.externalAssignees = externalAssignees;
					response.codemark.externalProviderHost = externalProviderHost;
				}

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

		trackPostCreation(request, textDocuments, codemarkId);
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
		entryPoint,
		status = "open",
		tags,
		relatedCodemarkIds,
		crossPostIssueValues
	}: CreatePostWithMarkerRequest): Promise<CreatePostResponse | undefined> {
		const codemarkRequest: CreateCodemarkRequest = {
			title,
			text,
			type,
			assignees,
			status: type === CodemarkType.Issue ? status : undefined,
			tags,
			relatedCodemarkIds,
			markers: []
		};

		const markerCreationDescriptors: MarkerCreationDescriptor[] = [];

		codemarkRequest.streamId = streamId;
		Logger.log(`createPostWithMarker: preparing descriptors for ${markers.length} markers`);
		for (const m of markers) {
			if (!m.range) continue;
			const descriptor = await MarkersManager.prepareMarkerCreationDescriptor(
				m.code,
				m.documentId,
				m.range,
				m.source
			);
			markerCreationDescriptors.push(descriptor);
			codemarkRequest.markers!.push(descriptor.marker);

			if (!codemarkRequest.remoteCodeUrl) {
				codemarkRequest.remoteCodeUrl = descriptor.marker.remoteCodeUrl;
			}
			if (!codemarkRequest.remotes) {
				codemarkRequest.remotes = descriptor.marker.remotes;
			}
		}

		try {
			Logger.log(`createPostWithMarker: creating post`);
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
			Logger.log(`createPostWithMarker: post creation completed`);

			const { markers } = response!;
			if (markers) {
				Logger.log(`createPostWithMarker: will save uncommitted locations`);
				MarkerLocationManager.saveUncommittedLocations(
					markers,
					markerCreationDescriptors.map(descriptor => descriptor.backtrackedLocation)
				).then(() => {
					Logger.log("Uncommitted locations saved to local cache");
				});
			}

			response.codemark!.markers = response.markers || [];
			Logger.log(`createPostWithMarker: returning`);
			return response;
		} catch (ex) {
			Logger.error(ex);
			Container.instance().errorReporter.reportMessage({
				type: ReportingMessageType.Error,
				source: "agent",
				message: "Post creation with markers failed",
				extra: {
					message: ex.message,
					streamId
				}
			});
			throw ex;
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
		return { post: await this.enrichPost(post) };
	}

	protected getEntityName(): string {
		return "Post";
	}

	protected bareRepo(repo: string): string {
		if (repo.match(/^(bitbucket\.org|github\.com)\/(.+)\//)) {
			repo = repo
				.split("/")
				.splice(2)
				.join("/");
		} else if (repo.indexOf("/") !== -1) {
			repo = repo
				.split("/")
				.splice(1)
				.join("/");
		}
		return repo;
	}

	getCodeDelimiters = (
		codeDelimiterStyle?: CodeDelimiterStyles
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
		providerCardRequest: {
			codemark: {
				text: string | undefined;
				title: string | undefined;
				markers?: CSMarker[];
				permalink?: string;
			};
			remotes?: string[];
		},
		attributes: CrossPostIssueValues
	) => {
		const delimiters = this.getCodeDelimiters(attributes.codeDelimiterStyle);
		const { linefeed, start, end } = delimiters;
		let description = `${providerCardRequest.codemark.text}${linefeed}${linefeed}`;

		if (providerCardRequest.codemark.markers && providerCardRequest.codemark.markers.length) {
			let createdAtLeastOne = false;
			for (const marker of providerCardRequest.codemark.markers) {
				const links = [];
				const repo = await SessionContainer.instance().repos.getById(marker.repoId);
				if (repo) {
					const repoName = this.bareRepo(repo.name);
					description += `[${repoName}] `;
				}
				description += marker.file;
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

				if (providerCardRequest.codemark.permalink) {
					let link = Strings.interpolate(delimiters.anchorFormat, {
						text: "Open on Web",
						url: `${providerCardRequest.codemark.permalink}?marker=${marker.id}`
					});
					if (link) {
						links.push(link);
					}

					link = Strings.interpolate(delimiters.anchorFormat, {
						text: "Open in IDE",
						url: `${providerCardRequest.codemark.permalink}?marker=${marker.id}&ide=default`
					});
					if (link) {
						links.push(link);
					}
				}
				if (providerCardRequest.remotes) {
					let url;
					if (
						providerCardRequest.remotes !== undefined &&
						providerCardRequest.remotes.length !== 0 &&
						range &&
						range.start !== undefined &&
						range.end !== undefined
					) {
						for (const remote of providerCardRequest.remotes) {
							url = Marker.getRemoteCodeUrl(
								remote,
								marker.commitHashWhenCreated,
								marker.file,
								range.start.line + 1,
								range.end.line + 1
							);

							if (url !== undefined) {
								break;
							}
						}
					}
					if (url) {
						const link = Strings.interpolate(delimiters.anchorFormat, {
							text: `Open on ${url.displayName}`,
							url: url.url
						});
						if (link) {
							links.push(link);
						}
					}
				}
				if (links.length) {
					description += links.join(" · ") + linefeed + linefeed;
					createdAtLeastOne = true;
				}
			}
			if (!createdAtLeastOne) {
				description += `${linefeed}Posted via CodeStream${linefeed}`;
			}
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
							summary: providerCardRequest.codemark.title,
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
							name: providerCardRequest.codemark.title,
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
							title: providerCardRequest.codemark.title,
							repoName: attributes.boardName,
							assignees: attributes.assignees
						}
					});
					break;
				}
				case "gitlab":
				case "gitlab_enterprise": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: providerCardRequest.codemark.title,
							repoName: attributes.boardName,
							assignee: attributes.assignees && attributes.assignees[0]
						}
					});
					break;
				}
				case "youtrack": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							name: providerCardRequest.codemark.title,
							boardId: attributes.board.id,
							assignee: attributes.assignees && attributes.assignees[0]
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
							name: providerCardRequest.codemark.title,
							assignee: attributes.assignees && attributes.assignees[0]
						}
					});
					break;
				}
				case "bitbucket": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: providerCardRequest.codemark.title,
							repoName: attributes.boardName,
							assignee: attributes.assignees && attributes.assignees[0]
						}
					});
					break;
				}
				case "azuredevops": {
					response = await providerRegistry.createCard({
						providerId: attributes.issueProvider.id,
						data: {
							description,
							title: providerCardRequest.codemark.title,
							boardId: attributes.board.id,
							assignee: attributes.assignees && attributes.assignees[0]
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
