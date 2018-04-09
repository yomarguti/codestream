'use strict';
import { Disposable, ExtensionContext } from 'vscode';
import { CodeStreamSession } from './api/session';
import { IConfig } from './config';
import { configuration } from './configuration';
import { UnreadDecorationProvider } from './decorationProvider';
import { CodeStreamExplorer } from './views/explorer';
import { Git } from './git/git';
import { StreamWebViewProvider } from './streamWebViewProvider';

export class Container {

    static async initialize(context: ExtensionContext, config: IConfig, session?: CodeStreamSession) {
        this._context = context;
        this._config = config;

        context.subscriptions.push(this._git = new Git());
        context.subscriptions.push(this._session = await CodeStreamSession.create(config.serverUrl));
        context.subscriptions.push(this._streamWebView = new StreamWebViewProvider());
        context.subscriptions.push(this._unreadDecorator = new UnreadDecorationProvider());

        if (config.explorer.enabled) {
            context.subscriptions.push(this._explorer = new CodeStreamExplorer());
        }
        else {
            let disposable: Disposable;
            disposable = configuration.onDidChange(e => {
                if (configuration.changed(e, configuration.name('explorer')('enabled').value)) {
                    disposable.dispose();
                    context.subscriptions.push(this._explorer = new CodeStreamExplorer());
                }
            });
        }
    }

    private static _config: IConfig | undefined;
    static get config() {
        if (this._config === undefined) {
            this._config = configuration.get<IConfig>();
        }
        return this._config;
    }

    private static _context: ExtensionContext;
    static get context() {
        return this._context;
    }

    private static _explorer: CodeStreamExplorer;
    static get explorer() {
        return this._explorer;
    }

    private static _git: Git;
    static get git() {
        return this._git;
    }

    private static _session: CodeStreamSession;
    static get session(): CodeStreamSession {
        return this._session;
    }

    private static _streamWebView: StreamWebViewProvider;
    static get streamWebView() {
        return this._streamWebView;
    }

    private static _unreadDecorator: UnreadDecorationProvider;
    static get unreadDecorator(): UnreadDecorationProvider {
        return this._unreadDecorator;
    }

    static resetConfig() {
        this._config = undefined;
    }
}
