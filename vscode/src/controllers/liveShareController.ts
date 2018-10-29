"use strict";
import { Disposable, Extension, extensions, Uri } from "vscode";
import * as vslsApi from "vsls/vscode";
import { ChannelServiceType } from "../agent/agentConnection";
import { ServiceChannelStreamCreationOptions } from "../api/models/streams";
import { SessionStatus, SessionStatusChangedEvent, StreamThread, StreamType } from "../api/session";
import { ContextKeys, setContext } from "../common";
import { Container } from "../container";
import { Logger } from "../logger";
import { Dates } from "../system";
import { VslsServiceRequestAction } from "../webviews/webviewIpc";

interface InviteCommandArgs {
	userIds: string | string[];
	createNewStream?: Boolean;
}

interface JoinCommandArgs {
	url: string;
}

interface StartCommandArgs {
	streamThread?: StreamThread;
	createNewStream?: Boolean;
}

export const vslsUrlRegex = /https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?(.+?)\b/;

export class LiveShareController implements Disposable {
	private _disposable: Disposable | undefined;
	private _vslsId: string | undefined;
	private _vslsPromise: Promise<vslsApi.LiveShare | null> | undefined;
	private readonly _vslsExtension: Extension<any> | undefined;

	constructor() {
		this._vslsExtension = extensions.getExtension(vslsApi.extensionId);
		void this.ensureLiveShare();
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	async ensureLiveShare(): Promise<void> {
		try {
			this._installed = this._vslsExtension != null;
			this._vslsPromise = this.getLiveShareApi();

			const vsls = await this._vslsPromise;
			this._installed = vsls != null;

			if (vsls != null) {
				setContext(ContextKeys.LiveShareInstalled, true);

				this.setVslsId(vsls.session.id);

				this._disposable = Disposable.from(
					Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
					vsls.onDidChangeSession(this.onLiveShareSessionChanged, this)
				);
			}
		} catch (ex) {
			debugger;
			Logger.error(ex);
		}
	}

	private async getLiveShareApi() {
		if (this._vslsExtension == null) return null;

		// Avoids using the vslsApi call because of module bundling issues
		const extensionApi = (this._vslsExtension.isActive
			? this._vslsExtension.exports
			: await this._vslsExtension.activate()) as any | undefined;
		if (extensionApi == null) return null;

		return extensionApi.getApi("0.3.666");
	}

	private _installed: boolean = false;
	get installed() {
		return this._installed;
	}

	get vslsId(): string | undefined {
		return this._vslsId;
	}
	private setVslsId(id: string | null) {
		this._vslsId = id == null ? undefined : id;
		setContext(ContextKeys.LiveShareSessionActive, id != null);
	}

	private async onLiveShareSessionChanged(e: vslsApi.SessionChangeEvent) {
		const vslsId = e.session.id;
		this.setVslsId(vslsId);
		// If we aren't signed in or in an active (remote) live share session kick out
		if (Container.session.status !== SessionStatus.SignedIn || vslsId == null) return;

		// If we are in an active (remote) live share session, open the liveshare channel
		const vslsChannel = await this.getVslsChannel(vslsId);
		if (vslsChannel === undefined) return;

		Container.commands.openStream({
			streamThread: { id: undefined, stream: vslsChannel }
		});
	}

	private async onSessionStatusChanged(e: SessionStatusChangedEvent) {
		const status = e.getStatus();
		// If we aren't signed in or in an active (remote) live share session kick out
		if (status !== SessionStatus.SignedIn || this.vslsId == null) return;

		// If we are in an active (remote) live share session, open the liveshare channel
		const vslsChannel = await this.getVslsChannel(this.vslsId);
		if (vslsChannel === undefined) return;

		Container.commands.openStream({
			streamThread: { id: undefined, stream: vslsChannel }
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

		this.setVslsId(vsls.session.id);

		let vslsChannel;
		if (args.createNewStream) {
			// Create a new channel specifically for this live share session
			const name = this.getVslsChannelName();
			vslsChannel = await Container.session.channels.getOrCreateByService(
				ChannelServiceType.Vsls,
				vsls.session.id!,
				{
					name: name,
					membership: memberIds,
					privacy: "private"
				}
			);
		} else {
			vslsChannel = direct;
		}

		await direct.post(`Join my Live Share session: ${uri.toString()}`);
		return Container.commands.openStream({
			streamThread: { id: undefined, stream: vslsChannel }
		});
	}

	async join(args: JoinCommandArgs) {
		const vsls = await this._vslsPromise;
		if (vsls == null) throw new Error("Live Share is not installed");

		const match = vslsUrlRegex.exec(args.url);
		if (match != null) {
			// Ensure we are a member of the channel
			await this.getVslsChannel(match[1]);
		}

		await vsls.join(Uri.parse(args.url), { newWindow: false });
	}

	async processRequest(action: VslsServiceRequestAction) {
		switch (action.type) {
			case "invite":
				await this.invite({ userIds: [action.userId], createNewStream: action.createNewStream });
				break;
			case "join":
				await this.join({ url: action.url });
				break;
			case "start":
				const stream = await Container.session.getStream(action.streamId);
				const streamThread =
					stream !== undefined ? { id: action.threadId, stream: stream } : undefined;

				await this.start({
					streamThread: streamThread,
					createNewStream: action.createNewStream
				});
				break;
		}
	}

	async start(args: StartCommandArgs) {
		const vsls = await this._vslsPromise;
		if (vsls == null) throw new Error("Live Share is not installed");

		const streamThread = args.streamThread || Container.webview.activeStreamThread;
		if (streamThread === undefined) return;

		Logger.log("LiveShareController.start");

		const uri = await vsls.share({ suppressNotification: true });
		if (uri == null) {
			Logger.warn("LiveShareController.start: FAILED");

			return;
		}

		this.setVslsId(vsls.session.id);

		const currentChannel = streamThread.stream;

		await currentChannel.post(`Join my Live Share session: ${uri.toString()}`, streamThread.id);

		if (!args.createNewStream) return;

		// Create a new channel specifically for this live share session, based on the current channel
		const name = this.getVslsChannelName();
		let createOptions: ServiceChannelStreamCreationOptions;
		switch (currentChannel.type) {
			case StreamType.Direct:
				createOptions = {
					name: name,
					membership: currentChannel.entity.memberIds,
					privacy: "private"
				};
				break;
			default:
				createOptions = {
					name: name,
					privacy: "public"
				};
				break;
		}

		const vslsChannel = await Container.session.channels.getOrCreateByService(
			ChannelServiceType.Vsls,
			vsls.session.id!,
			createOptions
		);

		return Container.commands.openStream({
			streamThread: { id: undefined, stream: vslsChannel }
		});
	}

	private async getVslsChannel(vslsId: string) {
		const vslsChannel = await Container.session.channels.getByService(
			ChannelServiceType.Vsls,
			vslsId
		);

		// Ensure we are a member of the channel
		if (vslsChannel !== undefined && !vslsChannel.memberOf(Container.session.userId)) {
			await Container.agent.streams.join(vslsChannel.id);
		}

		return vslsChannel;
	}

	private getVslsChannelName() {
		return `${Container.session.user.name} - Live Share - ${Dates.toFormatter(new Date()).format(
			"MMM Do h-mm-ssa"
		)}`;
	}
}
