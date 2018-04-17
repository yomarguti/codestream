'use strict';
import { Disposable, ExtensionContext } from 'vscode';
import { CodeStreamSession } from './api/session';
import { Commands } from './commands';
import { IConfig } from './config';
import { configuration } from './configuration';
// import { UnreadDecorationProvider } from './providers/decorationProvider';
import { CodeStreamExplorer } from './views/explorer';
import { Git } from './git/git';
import { StreamWebViewPanel } from './views/streamWebViewPanel';
import { CodeStreamCodeActionProvider } from './providers/codeActionProvider';
import { CodeStreamCodeLensProvider } from './providers/codeLensProvider';
import { CodeStreamMarkerDecorationProvider } from './providers/markerDecorationProvider';
import { StatusBarController } from './controllers/statusBarController';
import { UMIController } from './controllers/umiController';
import { LiveShareController } from './controllers/liveShareController';

export class Container {

    static async initialize(context: ExtensionContext, config: IConfig, session?: CodeStreamSession) {
        this._context = context;
        this._config = config;

        context.subscriptions.push(this._git = new Git());
        context.subscriptions.push(this._session = new CodeStreamSession(config.serverUrl));
        context.subscriptions.push(this._umis = new UMIController());
        context.subscriptions.push(this._liveShare = new LiveShareController());

        context.subscriptions.push(this._commands = new Commands());
        context.subscriptions.push(this._codeActions = new CodeStreamCodeActionProvider());
        // context.subscriptions.push(this._codeLens = new CodeStreamCodeLensProvider());
        context.subscriptions.push(this._markerDecorations = new CodeStreamMarkerDecorationProvider());
        context.subscriptions.push(this._statusBar = new StatusBarController());
        context.subscriptions.push(this._streamWebView = new StreamWebViewPanel(this._session));
        // context.subscriptions.push(this._unreadDecorator = new UnreadDecorationProvider());

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

    private static _codeActions: CodeStreamCodeActionProvider;
    static get codeActions() {
        return this._codeActions;
    }

    private static _codeLens: CodeStreamCodeLensProvider;
    static get codeLens() {
        return this._codeLens;
    }

    private static _commands: Commands;
    static get commands() {
        return this._commands;
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

    private static _liveShare: LiveShareController;
    static get liveShare() {
        return this._liveShare;
    }

    private static _markerDecorations: CodeStreamMarkerDecorationProvider;
    static get markerDecorations() {
        return this._markerDecorations;
    }

    private static _statusBar: StatusBarController;
    static get statusBar() {
        return this._statusBar;
    }

    private static _session: CodeStreamSession;
    static get session(): CodeStreamSession {
        return this._session;
    }

    private static _streamWebView: StreamWebViewPanel;
    static get streamWebView() {
        return this._streamWebView;
    }

    private static _umis: UMIController;
    static get umis() {
        return this._umis;
    }

    // private static _unreadDecorator: UnreadDecorationProvider;
    // static get unreadDecorator(): UnreadDecorationProvider {
    //     return this._unreadDecorator;
    // }

    static resetConfig() {
        this._config = undefined;
    }
}
