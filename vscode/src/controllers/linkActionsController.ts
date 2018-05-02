'use strict';
import { Disposable } from 'vscode';
import { Post, PostsReceivedEvent } from '../api/session';
import { Container } from '../container';

const codestreamRegex = /codestream:\/\/(.*?)\?d=(.*?)(?:&ui=.*?)?(?=\s|$)/; // codestream://service/action?d={data}

interface LinkActionCallbacks {
    onMatch: (post: Post, context: any) => any;
    onAction?: (context: any) => any;
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

            const [, path, qs] = match;

            const callbacks = this._registrationMap.get(path);
            if (callbacks === undefined || callbacks.onMatch === undefined) continue;

            callbacks.onMatch(post, JSON.parse(decodeURIComponent(qs)));
        }
    }

    execute(commandUri: string) {
        const match = codestreamRegex.exec(commandUri);
        if (match == null) return;

        const [, path, qs] = match;

        const callbacks = this._registrationMap.get(path);
        if (callbacks === undefined || callbacks.onAction === undefined) return;

        callbacks.onAction(JSON.parse(decodeURIComponent(qs)));
    }

    private _registrationMap = new Map<string, LinkActionCallbacks | undefined>();
    register<T>(service: string, action: string, callbacks: LinkActionCallbacks, thisArg?: any): Disposable {
        const key = `${service}/${action}`;

        if (thisArg !== undefined) {
            callbacks = {
                onMatch: callbacks.onMatch.bind(thisArg),
                onAction: callbacks.onAction !== undefined ? callbacks.onAction.bind(thisArg) : undefined
            };
        }
        else {
            callbacks = { ...callbacks };
        }

        this._registrationMap.set(key, callbacks);
        this.ensureRegistrations();

        return new Disposable(() => {
            this._registrationMap.delete(key);
            this.ensureRegistrations();
        });
    }

    toLinkAction<T>(service: string, action: string, context: T, ui: { type: 'button' | 'link', label: string }) {
        return `codestream://${service}/${action}?d=${encodeURIComponent(JSON.stringify(context))}&ui=${encodeURIComponent(JSON.stringify(ui))}`;
    }

    private ensureRegistrations() {
        if (this._registrationMap.size === 0) {
            if (this._disposable !== undefined) {
                this._disposable.dispose();
                this._disposable = undefined;
            }
        }
        else if (this._disposable === undefined) {
            this._disposable = Disposable.from(
                Container.session.onDidReceivePosts(this.onSessionPostsReceived, this)
            );
        }
    }
}
