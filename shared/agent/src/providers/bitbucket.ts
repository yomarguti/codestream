"use strict";
import * as qs from "querystring";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	BitbucketBoard,
	BitbucketCard,
	BitbucketCreateCardRequest,
	BitbucketCreateCardRequestType,
	BitbucketCreateCardResponse,
	BitbucketFetchBoardsRequest,
	BitbucketFetchBoardsRequestType,
	BitbucketFetchListsRequest,
	BitbucketFetchListsRequestType
} from "../shared/agent.protocol";
import { CSBitbucketProviderInfo } from "../shared/api.protocol";
import { log, lspHandler, lspProvider } from "../system";
import { ThirdPartyProviderBase } from "./provider";

interface BitbucketRepo {
	uuid: string;
	full_name: string;
	path: string;
	owner: {
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
	display_name: string;
	account_id: string;
}

interface BitbucketValues<T> {
	values: T;
	next: string;
}

@lspProvider("bitbucket")
export class BitbucketProvider extends ThirdPartyProviderBase<CSBitbucketProviderInfo> {
	private _bitbucketUserId: string | undefined;

	private _knownRepos = new Map<String, BitbucketRepo>();

	get baseUrl() {
		return "https://api.bitbucket.org/2.0";
	}

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
		this._knownRepos = new Map<String, BitbucketRepo>();
	}

	@log()
	@lspHandler(BitbucketFetchBoardsRequestType)
	async boards(request: BitbucketFetchBoardsRequest) {
		const { git } = Container.instance();
		const gitRepos = await git.getRepositories();
		const openRepos = new Map<String, BitbucketRepo>();

		for (const gitRepo of gitRepos) {
			const remotes = await git.getRepoRemotes(gitRepo.path);
			for (const remote of remotes) {
				if (remote.domain === "bitbucket.org" && !openRepos.has(remote.path)) {
					let bitbucketRepo = this._knownRepos.get(remote.path);
					if (!bitbucketRepo) {
						try {
							const response = await this.get<BitbucketRepo>(`/repositories/${remote.path}`);
							bitbucketRepo = {
								...response.body,
								path: gitRepo.path
							};
							this._knownRepos.set(remote.path, bitbucketRepo);
						} catch (err) {
							Logger.error(err);
							debugger;
						}
					}

					if (bitbucketRepo) {
						openRepos.set(remote.path, bitbucketRepo);
					}
				}
			}
		}

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
	@lspHandler(BitbucketCreateCardRequestType)
	async createCard(request: BitbucketCreateCardRequest) {
		const data: { [key: string]: any } = {
			title: request.title,
			content: {
				raw: request.description,
				markup: "markdown"
			}
		};
		if (request.assignee) {
			data.assignee = { username: request.assignee.username };
		}
		const response = await this.post<{}, BitbucketCreateCardResponse>(
			`/repositories/${request.repoName}/issues`,
			data
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

	@log()
	@lspHandler(BitbucketFetchListsRequestType)
	async lists(request: BitbucketFetchListsRequest) {}

	private async getMemberId() {
		const userResponse = await this.get<{ uuid: string; [key: string]: any }>(`/user`);

		return userResponse.body.uuid;
	}

	@log()
	async getAssignableUsers(request: { boardId: string }) {
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
		} catch (err) {
			Logger.error(err);
			return { users: [] };
		}
	}
}
