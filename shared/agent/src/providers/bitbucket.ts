"use strict";
import { Container } from "../container";
import { Logger } from "../logger";
import {
	BitbucketBoard,
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
import { ApiResponse, ThirdPartyProviderBase } from "./provider";

interface BitbucketRepo {
	full_name: any;
	uuid: string;
	path: string;
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
		// let boards: BitbucketBoard[];

		// try {
		// 	let apiResponse = await this.get<BitbucketBoard[]>(
		// 		`/user/repos?${qs.stringify({ access_token: this.token })}`
		// 	);
		// 	boards = apiResponse.body;
		//
		// 	let nextPage: string | undefined;
		// 	while ((nextPage = this.nextPage(apiResponse.response))) {
		// 		apiResponse = await this.get<BitbucketBoard[]>(nextPage);
		// 		boards = boards.concat(apiResponse.body);
		// 	}
		// } catch (err) {
		// 	boards = [];
		// 	Logger.error(err);
		// 	debugger;
		// }

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
			boards = Array.from(openRepos.values()).map(r => ({
				id: r.uuid,
				name: r.full_name,
				apiIdentifier: r.full_name,
				path: r.path
			}));
		} else {
			let bitbucketRepos: { [key: string]: string }[] = [];
			try {
				let apiResponse = await this.get<{ [key: string]: any }>(`/user/permissions/repositories`);
				bitbucketRepos = (apiResponse.body.values as any[]).map(p => p.repository);

				while (apiResponse.body.next) {
					apiResponse = await this.get<{ [key: string]: string }[]>(apiResponse.body.next);
					bitbucketRepos = bitbucketRepos.concat(apiResponse.body);
				}
			} catch (err) {
				Logger.error(err);
				debugger;
			}
			boards = bitbucketRepos.map(r => {
				return {
					...r,
					id: r.uuid,
					name: r.full_name,
					apiIdentifier: r.full_name
				};
			});
		}

		return {
			boards
		};
	}

	@log()
	@lspHandler(BitbucketCreateCardRequestType)
	async createCard(request: BitbucketCreateCardRequest) {
		const response = await this.post<{}, BitbucketCreateCardResponse>(
			`/repositories/${request.repoName}/issues`,
			{
				title: request.title,
				content: {
					raw: request.description,
					markup: "markdown"
				}
			}
		);
		return response;
	}

	@log()
	@lspHandler(BitbucketFetchListsRequestType)
	async lists(request: BitbucketFetchListsRequest) {}

	private async getMemberId() {
		const userResponse = await this.get<{ uuid: string; [key: string]: any }>(`/user`);

		return userResponse.body.uuid;
	}
}
