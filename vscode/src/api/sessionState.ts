"use strict";
import { LoginResponse } from "./api";
import { CSUser } from "./api";
import {
	ChannelAndDirectStreamCollection,
	ChannelStreamCollection,
	DirectStreamCollection
} from "./models/streams";
import { Team, TeamCollection } from "./models/teams";
import { User, UserCollection } from "./models/users";
import { CodeStreamSession } from "./session";

class UnreadCounter {
	lastReads: { [streamId: string]: number } = {};
	unread: { [streamId: string]: number } = {};
	mentions: { [streamId: string]: number } = {};

	incrementUnread(streamId: string) {
		const count = this.unread[streamId] || 0;
		this.unread[streamId] = count + 1;
	}

	incrementMention(streamId: string) {
		const count = this.mentions[streamId] || 0;
		this.mentions[streamId] = count + 1;
		this.incrementUnread(streamId);
	}

	clear(streamId: string) {
		this.unread[streamId] = 0;
		this.mentions[streamId] = 0;
	}

	getValues() {
		return {
			unread: this.unread,
			mentions: this.mentions,
			lastReads: this.lastReads
		};
	}

	getStreamIds() {
		return [...new Set([...Object.keys(this.unread), ...Object.keys(this.mentions)])];
	}
}

export class SessionState {
	_unreads: UnreadCounter;

	constructor(
		private readonly session: CodeStreamSession,
		public readonly teamId: string,
		private readonly _data: LoginResponse
	) {
		this._unreads = new UnreadCounter();
	}

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
			this._channels = new ChannelStreamCollection(this.session, this.teamId);
		}
		return this._channels;
	}

	private _channelsAndDMs: ChannelAndDirectStreamCollection | undefined;
	get channelsAndDMs() {
		if (this._channelsAndDMs === undefined) {
			this._channelsAndDMs = new ChannelAndDirectStreamCollection(this.session, this.teamId);
		}
		return this._channelsAndDMs;
	}

	private _directMessages: DirectStreamCollection | undefined;
	get directMessages() {
		if (this._directMessages === undefined) {
			this._directMessages = new DirectStreamCollection(this.session, this.teamId);
		}
		return this._directMessages;
	}

	private _team: Team | undefined;
	get team() {
		if (this._team === undefined) {
			this._team = new Team(this.session, this._data.teams.find(t => t.id === this.teamId)!);
		}
		return this._team!;
	}

	private _teams: TeamCollection | undefined;
	get teams() {
		if (this._teams === undefined) {
			this._teams = new TeamCollection(this.session, this._data.teams.map(t => t.id));
		}
		return this._teams;
	}

	private _user: User | undefined;
	get user() {
		if (this._user === undefined) {
			this._user = new User(this.session, this._data.user);
		}
		return this._user;
	}

	private _users: UserCollection | undefined;
	get users() {
		if (this._users === undefined) {
			this._users = new UserCollection(this.session, this.teamId);
		}
		return this._users;
	}

	get unreads() {
		return this._unreads;
	}

	hasSingleTeam(): Promise<boolean> {
		return Promise.resolve(this._data!.teams.length === 1);
	}

	updateUser(user: CSUser) {
		this._user = new User(this.session, user);
	}
}
