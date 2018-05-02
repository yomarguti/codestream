import { ConfigurationChangeEvent, Disposable } from 'vscode';
import { CSPost } from './api/api';
import { CodeStreamSession, PostsReceivedEvent } from './api/session';
import { BotResponse, configuration } from './configuration';
import { Container } from './container';
import { Logger } from './logger';

export class CodeStreamBot extends Disposable {

    private readonly _disposable: Disposable;
    private _disposableSignedIn: Disposable | undefined;
    private _session: CodeStreamSession | undefined;
    private _triggers: { regex: RegExp, response: BotResponse }[] = [];

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            configuration.onDidChange(this.onConfigurationChanged, this)
        );

        this.onConfigurationChanged(configuration.initializingChangeEvent);
    }

    dispose() {
        this.signOut();
        this._disposable && this._disposable.dispose();
    }

    private async onConfigurationChanged(e: ConfigurationChangeEvent) {
        const initializing = configuration.initializing(e);

        if (!initializing && !configuration.changed(e, configuration.name('bot').value)) return;

        if (initializing || configuration.changed(e, configuration.name('bot')('triggers').value)) {
            this._triggers = Container.config.bot.triggers.map(t => ({ regex: new RegExp(t.message, 'i'), response: t.response }));
        }

        if (initializing ||
            configuration.changed(e, configuration.name('bot')('enabled').value) ||
            configuration.changed(e, configuration.name('bot')('email').value) ||
            configuration.changed(e, configuration.name('bot')('password').value)) {
            this.signOut();
            if (Container.config.bot.enabled) {
                this.signIn();
            }
        }
    }

    async signIn() {
        if (this._session !== undefined || !Container.config.bot.email || !Container.config.bot.password) return;

        try {
            this._session = new CodeStreamSession(Container.config.serverUrl);

            this._disposableSignedIn = Disposable.from(
                this._session,
                this._session.onDidReceivePosts(this.onPostsReceived, this)
            );

            await this._session.login(Container.config.bot.email, Container.config.bot.password, Container.config.teamId);
        }
        catch (ex) {
            Logger.error(ex);
            debugger;
        }
    }

    signOut() {
        if (this._session === undefined) return;

        this._disposableSignedIn && this._disposableSignedIn.dispose();
        this._session === undefined;
    }

    private async onPostsReceived(e: PostsReceivedEvent) {
        for (const p of e.entities()) {
            for (const trigger of this._triggers) {
                if (!trigger.regex.test(p.text)) continue;

                this.sendResponse(trigger.response, p);
            }
        }
    }

    private async sendResponse(response: BotResponse, post: CSPost) {
        const stream = await this._session!.getStream(post.streamId);
        if (stream === undefined) return;

        stream.post(response.message, response.location === 'thread' ? post.id : undefined);
    }
}
