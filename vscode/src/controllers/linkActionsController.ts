"use strict";
import { Disposable } from "vscode";
import { Post, PostsReceivedEvent } from "../api/session";
import { Container } from "../container";

const codestreamRegex = /codestream:\/\/(.*?)\?d=(.*?)(?:&tt=(.*?))?(?=\s|$)/; // codestream://service/action?d={<data>}&tt={ type: 'button' | 'link', replacement: string } }
const codestreamMatchRegex = /(codestream:\/\/.*?\?d=.*?(?:&tt=.*?)?(?=\s|$))/;

interface LinkActionCallbacks {
	onMatch(post: Post, context: any): any;
	onAction?(context: any): any;
}

interface LinkActionTextTransformation {
	type: "button" | "link";
	replacement: string;
}

export class LinkActionsController extends Disposable {
	private _disposable: Disposable | undefined;

	constructor() {
		super(() => this.dispose());
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	private async onSessionPostsReceived(e: PostsReceivedEvent) {
		const currentUserId = Container.session.user.id;

		for (const post of e.items()) {
			if (post.deleted || post.senderId === currentUserId) continue;

			const match = codestreamRegex.exec(post.text);
			if (match == null) continue;

			const [, path, data] = match;

			const callbacks = this._registrationMap.get(path);
			if (callbacks === undefined || callbacks.onMatch === undefined) continue;

			callbacks.onMatch(post, JSON.parse(decodeURIComponent(data)));
		}
	}

	execute(commandUri: string) {
		const match = codestreamRegex.exec(commandUri);
		if (match == null) return;

		const [, path, data] = match;

		const callbacks = this._registrationMap.get(path);
		if (callbacks === undefined || callbacks.onAction === undefined) return;

		callbacks.onAction(JSON.parse(decodeURIComponent(data)));
	}

	private _registrationMap = new Map<string, LinkActionCallbacks | undefined>();
	register<T>(
		service: string,
		action: string,
		callbacks: LinkActionCallbacks,
		thisArg?: any
	): Disposable {
		const key = `${service}/${action}`;

		if (thisArg !== undefined) {
			callbacks = {
				onMatch: callbacks.onMatch.bind(thisArg),
				onAction: callbacks.onAction !== undefined ? callbacks.onAction.bind(thisArg) : undefined
			};
		} else {
			callbacks = { ...callbacks };
		}

		this._registrationMap.set(key, callbacks);
		this.ensureRegistrations();

		return new Disposable(() => {
			this._registrationMap.delete(key);
			this.ensureRegistrations();
		});
	}

	resolveTextTransformations(text: string) {
		const match = codestreamRegex.exec(text);
		if (match == null) return text;

		try {
			const [, , , tt] = match;
			const transform = JSON.parse(decodeURIComponent(tt)) as LinkActionTextTransformation;

			return text.replace(codestreamMatchRegex, match => transform.replacement);
		} catch {
			return text;
		}
	}

	toLinkAction<T>(
		service: string,
		action: string,
		context: T,
		transform: LinkActionTextTransformation
	) {
		return `codestream://${service}/${action}?d=${encodeURIComponent(
			JSON.stringify(context)
		)}&tt=${encodeURIComponent(JSON.stringify(transform))}`;
	}

	private ensureRegistrations() {
		if (this._registrationMap.size === 0) {
			if (this._disposable !== undefined) {
				this._disposable.dispose();
				this._disposable = undefined;
			}
		} else if (this._disposable === undefined) {
			this._disposable = Disposable.from(
				Container.session.onDidReceivePosts(this.onSessionPostsReceived, this)
			);
		}
	}
}
