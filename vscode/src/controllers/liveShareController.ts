"use strict";
import {
	commands,
	Disposable,
	Extension,
	extensions,
	MessageItem,
	window,
	workspace
} from "vscode";
import { Post, SessionStatus, SessionStatusChangedEvent } from "../api/session";
import { ContextKeys, setContext } from "../common";
import { Container } from "../container";
// import { RemoteRepository } from "../git/remoteGitService";
import { Logger } from "../logger";
import { Command, createCommandDecorator } from "../system";

const commandRegistry: Command[] = [];
const command = createCommandDecorator(commandRegistry);

const liveShareRegex = /https:\/\/(?:.*?)liveshare(?:.*?).visualstudio.com\/join\?(.*?)(?:\s|$)/;
let liveShare: Extension<any> | undefined;

interface LiveShareContext {
	url: string;
	sessionId: string;
	sessionUserId: string;
	streamId: string;
	memberIds: string[];
	// repos: RemoteRepository[];
}

interface InviteCommandArgs {
	userIds: string | string[];
}

interface JoinCommandArgs {
	context: LiveShareContext;
	url: string;
}

export class LiveShareController implements Disposable {
	static ensureLiveShare(): boolean {
		if (liveShare === undefined) {
			liveShare = extensions.getExtension("ms-vsliveshare.vsliveshare");
		}

		return liveShare !== undefined;
	}

	private readonly _disposable: Disposable | undefined;

	constructor() {
		if (!LiveShareController.ensureLiveShare()) return;

		setContext(ContextKeys.LiveShareInstalled, true);

		this._disposable = Disposable.from(
			...commandRegistry.map(({ name, key, method }) =>
				commands.registerCommand(name, (...args: any[]) => method.apply(this, args))
			),
			Container.session.onDidChangeStatus(this.onSessionStatusChanged, this),
			Container.linkActions.register<LiveShareContext>(
				"vsls",
				"join",
				{ onMatch: this.onJoinMatch, onAction: this.onJoinAction },
				this
			)
		);
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	get isInstalled() {
		return liveShare !== undefined;
	}

	get sessionId() {
		return workspace.getConfiguration("vsliveshare").get<string>("join.reload.workspaceId");
	}

	private onJoinAction(e: LiveShareContext) {
		return this.join({
			context: e,
			url: e.url
		});
	}

	private async onJoinMatch(post: Post, e: LiveShareContext) {
		Logger.log("LiveShareController.onRequestReceived: ", `data=${JSON.stringify(e)}`);

		const host = await Container.session.users.get(e.sessionUserId);

		if (host === undefined) {
			Logger.log(
				"LiveShareController.onRequestReceived: ",
				`Could not find host User(${e.sessionUserId})`
			);
			debugger;
			return;
		}

		Logger.log(
			"LiveShareController.onRequestReceived: ",
			`Host(${host.name}) User(${host.id}) found`
		);

		// Only notify if we've been mentioned
		if (!post.mentioned(Container.session.user.id)) return;

		const actions: MessageItem[] = [
			{ title: "Join Live Share" },
			{ title: "Ignore", isCloseAffordance: true }
		];

		const result = await window.showInformationMessage(
			`${host.name} is inviting you to join a Live Share session`,
			...actions
		);
		if (result === actions[0]) {
			this.onJoinAction(e);
		}
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		const sessionId = this.sessionId;
		// If we aren't in an active (remote) live share session kick out
		if (sessionId === undefined) return;

		const status = e.getStatus();
		if (status === SessionStatus.SignedOut) return;

		const context = Container.context.globalState.get<LiveShareContext>(`vsls:${sessionId}`);
		if (context === undefined) {
			Logger.warn("Unable to find live share context");
			return;
		}

		switch (status) {
			case SessionStatus.SigningIn:
				// Since we are in a live share session, swap out our git service
				// Container.overrideGit(new RemoteGitService(context.repos));
				break;

			case SessionStatus.SignedIn:
				// When we are signed in, open a channel for the liveshare
				Container.commands.openStream({
					streamThread: { id: undefined, streamId: context.streamId }
				});
				break;
		}
	}

	@command("vsls.invite")
	async invite(args: InviteCommandArgs) {
		if (!this.isInstalled) throw new Error("Live Share is not installed");

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
		const streamThread = Container.streamView.activeStreamThread;

		Logger.log(
			"LiveShareController.invite: ",
			`Users=${JSON.stringify(users.map(u => ({ id: u.id, name: u.name })))}`
		);

		const result = await commands.executeCommand("liveshare.start", { suppressNotification: true });
		if (result === undefined) return;

		const match = liveShareRegex.exec(result.toString());
		if (match == null) return;

		const [url, sessionId] = match;

		const currentUserId = Container.session.userId;
		const memberIds = [currentUserId, ...users.map(u => u.id)];
		// const repos = Iterables.map(
		// 	await Container.session.repos.items(),
		// 	r => ({ id: r.id, hash: "", normalizedUrl: r.normalizedUrl, url: r.url } as RemoteRepository)
		// );

		// Create a new channel specifically for this live share session
		const liveShareStream = await Container.session.channels.getOrCreateByName(
			`ls:${currentUserId}:${sessionId}`,
			{ membership: memberIds, privacy: "public" }
		);

		const link = Container.linkActions.toLinkAction<LiveShareContext>(
			"vsls",
			"join",
			{
				url: url,
				sessionId: sessionId,
				sessionUserId: currentUserId,
				streamId: liveShareStream.id,
				memberIds: memberIds
				// repos: [...repos]
			},
			{
				type: "link",
				replacement: `join my Live Share session`
			}
		);

		await Container.commands.post({
			streamThread: streamThread,
			text: `${users.map(u => `@${u.name}`).join(", ")} please ${link}`,
			send: true,
			silent: true
		});

		return await Container.commands.openStream({
			streamThread: { id: undefined, stream: liveShareStream }
		});
	}

	@command("vsls.join")
	async join(args: JoinCommandArgs) {
		await Container.context.globalState.update(`vsls:${args.context.sessionId}`, args.context);
		await commands.executeCommand("liveshare.join", args.url); // , { newWindow: true });

		// If we aren't already a member of the channel, join it
		if (!args.context.memberIds.includes(Container.session.userId)) {
			await Container.session.api.joinStream(args.context.streamId);
		}

		return await Container.commands.openStream({
			streamThread: { id: undefined, streamId: args.context.streamId }
		});
	}
}
