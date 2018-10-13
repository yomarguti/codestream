"use strict";
import {
	FetchUsersRequest,
	FetchUsersRequestType,
	FetchUsersResponse,
	GetMeRequest,
	GetMeRequestType,
	GetMeResponse,
	GetUnreadsRequest,
	GetUnreadsRequestType,
	GetUnreadsResponse,
	GetUserRequest,
	GetUserRequestType,
	GetUserResponse,
	InviteUserRequest,
	InviteUserRequestType,
	UpdatePreferencesRequest,
	UpdatePreferencesRequestType,
	UpdatePresenceRequest,
	UpdatePresenceRequestType
} from "../shared/agent.protocol";
import { CSMe, CSUser } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { CachedEntityManagerBase, Id } from "./entityManager";

export class UsersManager extends CachedEntityManagerBase<CSUser> {
	@lspHandler(FetchUsersRequestType)
	async get(request?: FetchUsersRequest): Promise<FetchUsersResponse> {
		let users = await this.ensureCached();
		if (request != null) {
			if (request.userIds != null && request.userIds.length !== 0) {
				users = users.filter(u => request.userIds!.includes(u.id));
			}
		}

		return { users: users };
	}

	protected async loadCache() {
		const response = await this.session.api.fetchUsers({});
		this.cache.set(response.users);
	}

	async getByEmails(
		emails: string[],
		options: { ignoreCase?: boolean } = { ignoreCase: true }
	): Promise<CSUser[]> {
		if (options.ignoreCase) {
			emails = emails.map(email => email.toLocaleUpperCase());
		}

		const users = (await this.get()).users;
		return users.filter(u =>
			emails.includes(options.ignoreCase ? u.email.toLocaleUpperCase() : u.email)
		);
	}

	protected async fetchById(userId: Id): Promise<CSUser> {
		const response = await this.session.api.getUser({ userId: userId });
		return response.user;
	}

	@lspHandler(InviteUserRequestType)
	inviteUser(request: InviteUserRequest) {
		return this.session.api.inviteUser(request);
	}

	@lspHandler(UpdatePreferencesRequestType)
	updatePreferences(request: UpdatePreferencesRequest) {
		return this.session.api.updatePreferences(request);
	}

	@lspHandler(UpdatePresenceRequestType)
	updatePresence(request: UpdatePresenceRequest) {
		return this.session.api.updatePresence(request);
	}

	@lspHandler(GetMeRequestType)
	private async getMe(request: GetMeRequest): Promise<GetMeResponse> {
		const me = (await this.getById(this.session.userId)) as CSMe;
		return { user: me };
	}

	@lspHandler(GetUnreadsRequestType)
	private getUnreads(request: GetUnreadsRequest): Promise<GetUnreadsResponse> {
		return this.session.api.getUnreads(request);
	}

	@lspHandler(GetUserRequestType)
	private async getUser(request: GetUserRequest): Promise<GetUserResponse> {
		const user = await this.getById(request.userId);
		return { user: user };
	}
}
