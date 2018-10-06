"use strict";
import {
	FetchUsersRequest,
	FetchUsersRequestType,
	FetchUsersResponse,
	GetMeRequest,
	GetMeRequestType,
	GetMeResponse,
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
import { EntityManager, Id } from "./managers";

export class UsersManager extends EntityManager<CSUser> {
	private loaded = false;

	async getAll(): Promise<CSUser[]> {
		if (!this.loaded) {
			const response = await this.session.api.fetchUsers({});
			for (const user of response.users) {
				this.cache.set(user);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	async getByEmails(
		emails: string[],
		options: { ignoreCase?: boolean } = { ignoreCase: true }
	): Promise<CSUser[]> {
		if (options.ignoreCase) {
			emails = emails.map(email => email.toLocaleUpperCase());
		}

		const users = await this.getAll();
		return users.filter(u =>
			emails.includes(options.ignoreCase ? u.email.toLocaleUpperCase() : u.email)
		);
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

	protected async fetch(userId: Id): Promise<CSUser> {
		const response = await this.session.api.getUser({ userId: userId });
		return response.user;
	}

	@lspHandler(FetchUsersRequestType)
	private async fetchUsers(request: FetchUsersRequest): Promise<FetchUsersResponse> {
		const users = await this.getAll();
		if (request.userIds == null || request.userIds.length === 0) {
			return { users: users };
		}

		return { users: users.filter(u => request.userIds!.includes(u.id)) };
	}

	@lspHandler(GetMeRequestType)
	private async getMe(request: GetMeRequest): Promise<GetMeResponse> {
		const me = (await this.getById(this.session.userId)) as CSMe;
		return { user: me };
	}

	@lspHandler(GetUserRequestType)
	private async getUser(request: GetUserRequest): Promise<GetUserResponse> {
		const user = await this.getById(request.userId);
		return { user: user };
	}
}
