"use strict";
import { GitRemote } from "git/gitService";
import * as paths from "path";
import * as qs from "querystring";
import { URI } from "vscode-uri";
import { SessionContainer } from "../container";
import { Logger } from "../logger";
import { Markerish, MarkerLocationManager } from "../managers/markerLocationManager";
import {
	BitbucketBoard,
	BitbucketCard,
	BitbucketCreateCardRequest,
	BitbucketCreateCardResponse,
	CreateThirdPartyCardRequest,
	DocumentMarker,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse
} from "../protocol/agent.protocol";
import { CodemarkType, CSBitbucketProviderInfo, CSLocationArray } from "../protocol/api.protocol";
import { Arrays, log, lspProvider, Strings } from "../system";
import {
	ApiResponse,
	getOpenedRepos,
	getRepoRemotePaths,
	PullRequestComment,
	ThirdPartyProviderBase,
	ThirdPartyProviderSupportsIssues,
	ThirdPartyProviderSupportsPullRequests
} from "./provider";

interface BitbucketRepo {
	uuid: string;
	full_name: string;
	path: string;
	owner: {
		uuid: string;
		username: string;
		type: string;
	};
	has_issues: boolean;
}

interface BitbucketPermission {
	permission: string;
	repository: BitbucketRepo;
}

interface BitbucketUser {
	uuid: string;
	display_name: string;
	account_id: string;
}

interface BitbucketValues<T> {
	values: T;
	next: string;
}

interface BitbucketPullRequest {
	id: number;
	title: string;
	links: {
		html: { href: string };
		comments: {
			href: string;
		};
	};
}

interface BitbucketPullRequestComment {
	id: string;
	user: {
		account_id: string;
		nickname: string;
	};
	content: {
		raw: string;
	};
	created_on: string;
	links: { html: { href: string }; code: { href: string } };
	inline: {
		to?: number;
		from?: number;
		outdated?: boolean;
		path: string;
	};
	pullrequest: {
		id: number;
		title: string;
		links: {
			html: {
				href: string;
			};
		};
	};
}

interface GetPullRequestsResponse extends BitbucketValues<BitbucketPullRequest[]> {}

interface GetPullRequestCommentsResponse extends BitbucketValues<BitbucketPullRequestComment[]> {}

@lspProvider("bitbucket")
export class BitbucketProvider extends ThirdPartyProviderBase<CSBitbucketProviderInfo>
	implements ThirdPartyProviderSupportsIssues, ThirdPartyProviderSupportsPullRequests {
	private _bitbucketUserId: string | undefined;
	private _knownRepos = new Map<string, BitbucketRepo>();

	get displayName() {
		return "Bitbucket";
	}

	get name() {
		return "bitbucket";
	}

	get headers() {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			"Content-Type": "application/json"
		};
	}

	async onConnected() {
		this._bitbucketUserId = await this.getMemberId();
		this._knownRepos = new Map<string, BitbucketRepo>();
	}

	@log()
	async getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse> {
		void (await this.ensureConnected());

		const openRepos = await getOpenedRepos<BitbucketRepo>(
			r => r.domain === "bitbucket.org",
			p => this.get<BitbucketRepo>(`/repositories/${p}`),
			this._knownRepos
		);

		let boards: BitbucketBoard[];
		if (openRepos.size > 0) {
			const bitbucketRepos = Array.from(openRepos.values());
			boards = bitbucketRepos
				.filter(r => r.has_issues)
				.map(r => ({
					id: r.uuid,
					name: r.full_name,
					apiIdentifier: r.full_name,
					path: r.path,
					signelAssignee: true // bitbucket issues only allow one assignee
				}));
		} else {
			let bitbucketRepos: BitbucketRepo[] = [];
			try {
				let apiResponse = await this.get<BitbucketValues<BitbucketPermission[]>>(
					`/user/permissions/repositories?${qs.stringify({
						fields: "+values.repository.has_issues"
					})}`
				);
				bitbucketRepos = apiResponse.body.values.map(p => p.repository);
				while (apiResponse.body.next) {
					apiResponse = await this.get<BitbucketValues<BitbucketPermission[]>>(
						apiResponse.body.next
					);
					bitbucketRepos = bitbucketRepos.concat(apiResponse.body.values.map(p => p.repository));
				}
			} catch (err) {
				Logger.error(err);
				debugger;
			}
			bitbucketRepos = bitbucketRepos.filter(r => r.has_issues);
			boards = bitbucketRepos.map(r => {
				return {
					...r,
					id: r.uuid,
					name: r.full_name,
					apiIdentifier: r.full_name,
					singleAssignee: true // bitbucket issues only allow one assignee
				};
			});
		}

		return { boards };
	}

	@log()
	async createCard(request: CreateThirdPartyCardRequest) {
		void (await this.ensureConnected());

		const data = request.data as BitbucketCreateCardRequest;
		const cardData: { [key: string]: any } = {
			title: data.title,
			content: {
				raw: data.description,
				markup: "markdown"
			}
		};
		if (data.assignee) {
			cardData.assignee = { uuid: data.assignee.uuid };
		}
		const response = await this.post<{}, BitbucketCreateCardResponse>(
			`/repositories/${data.repoName}/issues`,
			cardData
		);
		let card = response.body;
		let issueResponse;
		try {
			const strippedPath = card.links.self.href.split(this.baseUrl)[1];
			issueResponse = await this.get<BitbucketCard>(strippedPath);
		} catch (err) {
			Logger.error(err);
			return card;
		}
		card = issueResponse.body;
		card.url = card.links.html!.href;
		return card;
	}

	private async getMemberId() {
		const userResponse = await this.get<{ uuid: string; [key: string]: any }>(`/user`);

		return userResponse.body.uuid;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
		void (await this.ensureConnected());

		try {
			const repoResponse = await this.get<BitbucketRepo>(`/repositories/${request.boardId}`);
			if (repoResponse.body.owner.type === "team") {
				let members: BitbucketUser[] = [];
				let apiResponse = await this.get<BitbucketValues<BitbucketUser[]>>(
					`/users/${repoResponse.body.owner.username}/members`
				);
				members = apiResponse.body.values;
				while (apiResponse.body.next) {
					apiResponse = await this.get<BitbucketValues<BitbucketUser[]>>(apiResponse.body.next);
					members = members.concat(apiResponse.body.values);
				}

				return {
					users: members.map(u => ({ ...u, id: u.account_id, displayName: u.display_name }))
				};
			} else {
				const userResponse = await this.get<BitbucketUser>("/user");
				const user = userResponse.body;
				return { users: [{ ...user, id: user.account_id, displayName: user.display_name }] };
			}
		} catch (ex) {
			Logger.error(ex);
			return { users: [] };
		}
	}

	@log()
	async getPullRequestDocumentMarkers({
		uri,
		revision,
		repoId,
		streamId
	}: {
		uri: URI;
		revision: string | undefined;
		repoId: string | undefined;
		streamId: string;
	}): Promise<DocumentMarker[]> {
		void (await this.ensureConnected());

		const documentMarkers: DocumentMarker[] = [];

		const comments = await this._getCommentsForPath(uri.fsPath);
		if (comments === undefined) return documentMarkers;

		const teamId = SessionContainer.instance().session.teamId;

		const commentsById: { [id: string]: PullRequestComment } = Object.create(null);
		const markersByCommit = new Map<string, Markerish[]>();

		for (const c of comments) {
			let markers = markersByCommit.get(c.commit);
			if (markers === undefined) {
				markers = [];
				markersByCommit.set(c.commit, markers);
			}

			commentsById[c.id] = c;
			markers.push({
				id: c.id,
				locationWhenCreated: [c.line, 1, c.line + 1, 1, undefined] as CSLocationArray
			});
		}

		const locations = await MarkerLocationManager.computeCurrentLocations(
			uri.fsPath,
			revision!,
			markersByCommit
		);

		for (const [id, location] of Object.entries(locations.locations)) {
			const comment = commentsById[id];

			documentMarkers.push({
				id: id,
				fileUri: uri.toString(),
				codemarkId: undefined,
				fileStreamId: streamId,
				// postId: undefined!,
				// postStreamId: undefined!,
				repoId: repoId!,
				teamId: teamId,
				file: uri.fsPath,
				// commitHashWhenCreated: revision!,
				// locationWhenCreated: MarkerLocation.toArray(location),
				modifiedAt: new Date(comment.createdAt).getTime(),
				code: comment.code,

				createdAt: new Date(comment.createdAt).getTime(),
				creatorId: comment.author.id,
				creatorName: comment.author.nickname,
				externalContent: {
					provider: {
						name: this.displayName,
						icon: this.name
					},
					subhead: `#${comment.pullRequest.id}`,
					actions: [
						{
							label: "Open Comment",
							uri: comment.url
						},
						{
							label: `Open Merge Request #${comment.pullRequest.id}`,
							uri: comment.pullRequest.url
						}
					]
				},
				range: {
					start: {
						line: location.lineStart - 1,
						character: 0
					},
					end: {
						line: location.lineEnd - 1,
						character: 0
					}
				},
				location: location,
				summary: comment.text,
				summaryMarkdown: `\n\n${Strings.escapeMarkdown(comment.text)}`,
				type: CodemarkType.Comment
			});
		}

		return documentMarkers;
	}
	private _commentsByRepoAndPath = new Map<
		string,
		{ expiresAt: number; comments: Promise<PullRequestComment[]> }
	>();

	private _isMatchingRemotePredicate = (r: GitRemote) => r.domain === "bitbucket.org";
	protected getIsMatchingRemotePredicate() {
		return this._isMatchingRemotePredicate;
	}

	@log()
	private async _getCommentsForPath(filePath: string): Promise<PullRequestComment[] | undefined> {
		const cc = Logger.getCorrelationContext();

		try {
			const { remotePath, repoPath } = await getRepoRemotePaths(
				filePath,
				this.getIsMatchingRemotePredicate(),
				this._knownRepos
			);
			if (remotePath == null || repoPath == null) return undefined;

			const relativePath = Strings.normalizePath(paths.relative(repoPath, filePath));
			const cacheKey = `${repoPath}|${relativePath}`;

			const cachedComments = this._commentsByRepoAndPath.get(cacheKey);
			if (cachedComments !== undefined && cachedComments.expiresAt > new Date().getTime()) {
				return cachedComments.comments;
			}

			const commentsPromise = this._getCommentsForPathCore(relativePath, remotePath);
			this._commentsByRepoAndPath.set(cacheKey, {
				expiresAt: new Date().setMinutes(new Date().getMinutes() + 30),
				comments: commentsPromise
			});

			const comments = await commentsPromise;

			return comments;
		} catch (ex) {
			Logger.error(ex, cc);
			return undefined;
		}
	}

	private async _getCommentsForPathCore(relativePath: string, remotePath: string) {
		const pullRequestsResponse = await this.get<GetPullRequestsResponse>(
			`/repositories/${remotePath}/pullrequests?${qs.stringify({ q: "comment_count>0" })}`
		);

		const comments = (await Promise.all(
			pullRequestsResponse.body.values.map(pr => this._getPullRequestComments(pr, relativePath))
		)).reduce((group, current) => group.concat(current));
		return comments;
	}

	private async _getPullRequestComments(
		pr: BitbucketPullRequest,
		filePath: string
	): Promise<PullRequestComment[]> {
		const comments: PullRequestComment[] = [];
		let nextPage: string | undefined = pr.links.comments.href.replace(this.baseUrl, "");

		while (nextPage) {
			const commentsResponse: ApiResponse<GetPullRequestCommentsResponse> = await this.get(
				`${nextPage}?${qs.stringify({
					q: `inline.path="${filePath}"`,
					fields:
						"values.inline.*,values.content.raw,values.user.nickname,values.user.account_id,values.links.html.href,values.created_on,values.links.code.href,values.id"
				})}`
			);
			comments.push(
				...Arrays.filterMap(commentsResponse.body.values, comment => {
					if (comment.inline.outdated) return undefined;

					const [source, destination] = comment.links.code.href
						.match(/\:([^\/][\d\S]+)\?/)![1]
						.split("..");

					const [commit, line] = comment.inline.from
						? [destination, comment.inline.from]
						: [source, comment.inline.to];

					return {
						commit,
						id: comment.id,
						text: comment.content.raw,
						code: "",
						author: { ...comment.user, id: comment.user.account_id },
						line: Number(line),
						path: comment.inline.path,
						url: comment.links.html.href,
						createdAt: new Date(comment.created_on).getTime(),
						pullRequest: {
							id: pr.id,
							title: pr.title,
							url: pr.links.html.href
						}
					};
				})
			);

			if (commentsResponse.body.next) {
				nextPage = commentsResponse.body.next.replace(this.baseUrl, "");
			} else {
				nextPage = undefined;
			}
		}
		return comments;
	}
}
