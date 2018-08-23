"use strict";
import { commands, Disposable, Extension, extensions, MessageItem, Uri, window } from "vscode";
import * as vsls from "vsls/vscode";
import { ChannelServiceType } from "../api/api";
import { ServiceChannelStreamCreationOptions } from "../api/models/streams";
import {
	ChannelStreamCreationOptions,
	Post,
	SessionStatus,
	SessionStatusChangedEvent,
	StreamThread,
	StreamType
} from "../api/session";
import { ContextKeys, setContext } from "../common";
import { Container } from "../container";
import { Logger } from "../logger";
import { Dates } from "../system";
import { VslsServiceRequestAction } from "../webviews/webviewIpc";

interface InviteCommandArgs {
	userIds: string | string[];
}

interface JoinCommandArgs {
	url: string;
}

interface StartCommandArgs {
	streamThread?: StreamThread;
}

export const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?.+?\b/;

export class LiveShareController implements Disposable {
	private _disposable: Disposable | undefined;
	private _sessionId: string | undefined;
	private readonly _vslsPromise: Promise<vsls.LiveShare | null>;
	private readonly _vslsExtension: Extension<any> | undefined;

	constructor() {
		this._vslsExtension = extensions.getExtension("ms-vsliveshare.vsliveshare");

		this._vslsPromise = vsls.getApiAsync();
		void this.ensureLiveShare();
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	async ensureLiveShare(): Promise<void> {
		const vsls = await this._vslsPromise;
		if (vsls != null) {
			setContext(ContextKeys.LiveShareInstalled, true);

			this.setSessionId(vsls.session.id);

			this._disposable = Disposable.from(
				Container.session.onDidChangeStatus(this.onSessionStatusChanged, this),
				vsls.onDidChangeSession(this.onLiveShareSessionChanged, this)
			);
		}
	}

	get installed() {
		return this._vslsExtension != null;
	}

	get sessionId(): string | undefined {
		return this._sessionId;
	}

	private setSessionId(id: string | null) {
		this._sessionId = id == null ? undefined : id;
		setContext(ContextKeys.LiveShareSessionActive, id != null);
	}

	private async onLiveShareSessionChanged(e: vsls.SessionChangeEvent) {
		const sessionId = e.session.id;
		this.setSessionId(sessionId);
		if (sessionId == null) return;

		// If we are in an active (remote) live share session, open the liveshare channel
		const channel = await Container.session.channels.getByService(
			ChannelServiceType.Vsls,
			sessionId
		);
		if (channel === undefined) return;

		Container.commands.openStream({
			streamThread: { id: undefined, stream: channel }
		});
	}

	private async onSessionStatusChanged(e: SessionStatusChangedEvent) {
		const status = e.getStatus();
		// If we aren't signed in or in an active (remote) live share session kick out
		if (status !== SessionStatus.SignedIn || this.sessionId === undefined) return;

		// If we are in an active (remote) live share session, open the liveshare channel
		const channel = await Container.session.channels.getByService(
			ChannelServiceType.Vsls,
			this.sessionId
		);
		if (channel === undefined) return;

		Container.commands.openStream({
			streamThread: { id: undefined, stream: channel }
		});
	}

	async invite(args: InviteCommandArgs) {
		const vsls = await this._vslsPromise;
		if (vsls == null) throw new Error("Live Share is not installed");

		const users = [];
		if (typeof args.userIds === "string") {
			const user = await Container.session.users.get(args.userIds);
			if (user !== undefined) {
				users.push(user);
			}
		} else {
			for (const id of args.userIds) {
				const user = await Container.session.users.get(id);
				if (user !== undefined) {
					users.push(user);
				}
			}
		}

		const currentUserId = Container.session.userId;
		const memberIds = [currentUserId, ...users.map(u => u.id)];

		const direct = await Container.session.directMessages.getOrCreateByMembers(memberIds);

		Logger.log(
			"LiveShareController.invite:",
			`Users=${JSON.stringify(users.map(u => ({ id: u.id, name: u.name })))}`
		);

		const uri = await vsls.share({ suppressNotification: true });
		if (uri == null) {
			Logger.warn(
				"LiveShareController.invite: FAILED",
				`Users=${JSON.stringify(users.map(u => ({ id: u.id, name: u.name })))}`
			);

			return;
		}

		this.setSessionId(vsls.session.id);

		// Create a new channel specifically for this live share session
		const name = this.getChannelName();
		const channel = await Container.session.channels.getOrCreateByService(
			ChannelServiceType.Vsls,
			vsls.session.id!,
			{
				name: name,
				membership: memberIds,
				privacy: "private"
			}
		);

		await Container.commands.post({
			streamThread: { id: undefined, stream: direct },
			text: `Join my Live Share session: ${uri.toString()}`,
			send: true,
			silent: true
		});

		return Container.commands.openStream({
			streamThread: { id: undefined, stream: channel }
		});
	}

	async join(args: JoinCommandArgs) {
		const vsls = await this._vslsPromise;
		if (vsls == null) throw new Error("Live Share is not installed");

		await vsls.join(Uri.parse(args.url), { newWindow: false });
	}

	async processRequest(action: VslsServiceRequestAction) {
		switch (action.type) {
			case "invite":
				await this.invite({ userIds: [action.userId] });
				break;
			case "join":
				await this.join({ url: action.url });
				break;
			case "start":
				const stream = await Container.session.getStream(action.streamId);
				const streamThread =
					stream !== undefined ? { id: action.threadId, stream: stream } : undefined;

				await this.start({ streamThread: streamThread });
				break;
		}
	}

	async start(args: StartCommandArgs) {
		const vsls = await this._vslsPromise;
		if (vsls == null) throw new Error("Live Share is not installed");

		const streamThread = args.streamThread || Container.streamView.activeStreamThread;
		if (streamThread === undefined) return;

		Logger.log("LiveShareController.start");

		const uri = await vsls.share({ suppressNotification: true });
		if (uri == null) {
			Logger.warn("LiveShareController.start: FAILED");

			return;
		}

		this.setSessionId(vsls.session.id);

		// Create a new channel specifically for this live share session, based on the current channel
		const stream = streamThread.stream;

		const name = this.getChannelName();
		let createOptions: ServiceChannelStreamCreationOptions;
		switch (stream.type) {
			case StreamType.Channel:
				createOptions = {
					name: name,
					membership: stream.entity.memberIds === undefined ? "auto" : stream.entity.memberIds,
					privacy: stream.entity.privacy
				};
				break;
			case StreamType.Direct:
				createOptions = {
					name: name,
					membership: stream.entity.memberIds,
					privacy: "private"
				};
				break;
			default:
				createOptions = {
					name: name,
					membership: "auto",
					privacy: "public"
				};
				break;
		}

		const channel = await Container.session.channels.getOrCreateByService(
			ChannelServiceType.Vsls,
			vsls.session.id!,
			createOptions
		);

		await Container.commands.post({
			streamThread: streamThread,
			text: `Join my Live Share session: ${uri.toString()}`,
			send: true,
			silent: true
		});

		return Container.commands.openStream({
			streamThread: { id: undefined, stream: channel }
		});
	}

	private getChannelName() {
		return `${Container.session.user.name} - Live Share - ${Dates.toFormatter(new Date()).format(
			"MMM Do h-mm-ssa"
		)}`;
	}
}
