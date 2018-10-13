"use strict";
import { CSMe, LoginResponse } from "../agent/agentConnection";
import { Container } from "../container";
import {
	ChannelAndDirectStreamCollection,
	ChannelStreamCollection,
	DirectStreamCollection
} from "./models/streams";
import { Team } from "./models/teams";
import { User, UserCollection } from "./models/users";
import { CodeStreamSession } from "./session";

export class SessionState {
	constructor(
		private readonly _session: CodeStreamSession,
		public readonly teamId: string,
		private readonly _data: LoginResponse
	) {}

	get pubnubKey() {
		return this._data.pubnubKey;
	}

	get token(): string {
		return this._data.accessToken;
	}

	get userId() {
		return this._data.user.id;
	}

	private _channels: ChannelStreamCollection | undefined;
	get channels() {
		if (this._channels === undefined) {
			this._channels = new ChannelStreamCollection(this._session, this.teamId);
		}
		return this._channels;
	}

	private _channelsAndDMs: ChannelAndDirectStreamCollection | undefined;
	get channelsAndDMs() {
		if (this._channelsAndDMs === undefined) {
			this._channelsAndDMs = new ChannelAndDirectStreamCollection(this._session, this.teamId);
		}
		return this._channelsAndDMs;
	}

	private _directMessages: DirectStreamCollection | undefined;
	get directMessages() {
		if (this._directMessages === undefined) {
			this._directMessages = new DirectStreamCollection(this._session, this.teamId);
		}
		return this._directMessages;
	}

	private _team: Team | undefined;
	get team() {
		if (this._team === undefined) {
			this._team = new Team(this._session, this._data.teams.find(t => t.id === this.teamId)!);
		}
		return this._team!;
	}

	private _user: User | undefined;
	get user() {
		if (this._user === undefined) {
			this._user = new User(this._session, this._data.user);
		}
		return this._user;
	}

	private _users: UserCollection | undefined;
	get users() {
		if (this._users === undefined) {
			this._users = new UserCollection(this._session, this.teamId);
		}
		return this._users;
	}

	hasSingleTeam(): boolean {
		return this._data!.teams.length === 1;
	}

	async updateTeams() {
		const response = await Container.agent.teams.fetch();
		this._data.teams = await response.teams;
		this._team = undefined;
	}

	updateUser(user: CSMe) {
		this._data.user = user;
		this._user = undefined;
	}
}
