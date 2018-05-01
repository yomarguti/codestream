'use strict';
import { Disposable, ExtensionContext } from 'vscode';
import { CodeStreamSession } from './api/session';
import { Commands } from './commands';
import { IConfig } from './config';
import { configuration } from './configuration';
import { CodeStreamCodeActionProvider } from './providers/codeActionProvider';
// import { CodeStreamCodeLensProvider } from './providers/codeLensProvider';
import { ChannelsExplorer, LiveShareExplorer, PeopleExplorer, RepositoriesExplorer } from './views/explorer';
import { GitService, IGitService } from './git/gitService';
import { LinkActionsController } from './controllers/linkActionsController';
import { LiveShareController } from './controllers/liveShareController';
import { MarkerDecorationProvider } from './providers/markerDecorationProvider';
import { NotificationsController } from './controllers/notificationsController';
import { StatusBarController } from './controllers/statusBarController';
import { StreamViewController } from './controllers/streamViewController';
import { CodeStreamBot } from './codestreamBot';
// import { UnreadDecorationProvider } from './providers/decorationProvider';

export class Container {

    static async initialize(context: ExtensionContext, config: IConfig, session?: CodeStreamSession) {
        this._context = context;
        this._config = config;

        context.subscriptions.push(this._git = new GitService());
        context.subscriptions.push(this._session = new CodeStreamSession(config.serverUrl));

        context.subscriptions.push(this._notifications = new NotificationsController());
        context.subscriptions.push(this._linkActions = new LinkActionsController());
        context.subscriptions.push(this._liveShare = new LiveShareController());

        context.subscriptions.push(this._commands = new Commands());
        context.subscriptions.push(this._codeActions = new CodeStreamCodeActionProvider());
        // context.subscriptions.push(this._codeLens = new CodeStreamCodeLensProvider());
        context.subscriptions.push(this._markerDecorations = new MarkerDecorationProvider());
        context.subscriptions.push(this._statusBar = new StatusBarController());
        // context.subscriptions.push(this._unreadDecorator = new UnreadDecorationProvider());

        context.subscriptions.push(this._streamView = new StreamViewController(this._session));

        if (config.explorers.enabled) {
            context.subscriptions.push(this._channelsExplorer = new ChannelsExplorer());
            context.subscriptions.push(this._liveShareExplorer = new LiveShareExplorer());
            context.subscriptions.push(this._peopleExplorer = new PeopleExplorer());
            context.subscriptions.push(this._repositoriesExplorer = new RepositoriesExplorer());
        }
        else {
            let disposable: Disposable;
            disposable = configuration.onDidChange(e => {
                if (configuration.changed(e, configuration.name('explorers')('enabled').value)) {
                    disposable.dispose();
                    context.subscriptions.push(this._channelsExplorer = new ChannelsExplorer());
                    context.subscriptions.push(this._liveShareExplorer = new LiveShareExplorer());
                    context.subscriptions.push(this._peopleExplorer = new PeopleExplorer());
                    context.subscriptions.push(this._repositoriesExplorer = new RepositoriesExplorer());
                }
            });
        }

        context.subscriptions.push(this._bot = new CodeStreamBot());
    }

    private static _bot: CodeStreamBot;
    static get bot() {
        return this._bot;
    }

    private static _codeActions: CodeStreamCodeActionProvider;
    static get codeActions() {
        return this._codeActions;
    }

    // private static _codeLens: CodeStreamCodeLensProvider;
    // static get codeLens() {
    //     return this._codeLens;
    // }

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

    private static _channelsExplorer: ChannelsExplorer;
    static get channelsExplorer() {
        return this._channelsExplorer;
    }

    private static _liveShareExplorer: LiveShareExplorer;
    static get liveShareExplorer() {
        return this._liveShareExplorer;
    }

    private static _peopleExplorer: PeopleExplorer;
    static get peopleExplorer() {
        return this._peopleExplorer;
    }

    private static _repositoriesExplorer: RepositoriesExplorer;
    static get repositoriesExplorer() {
        return this._repositoriesExplorer;
    }

    private static _git: IGitService;
    static get git() {
        return this._git;
    }

    static overrideGit(git: IGitService) {
        this._git = git;
    }

    private static _linkActions: LinkActionsController;
    static get linkActions() {
        return this._linkActions;
    }

    private static _liveShare: LiveShareController;
    static get liveShare() {
        return this._liveShare;
    }

    private static _markerDecorations: MarkerDecorationProvider;
    static get markerDecorations() {
        return this._markerDecorations;
    }

    private static _notifications: NotificationsController;
    static get notifications() {
        return this._notifications;
    }

    private static _statusBar: StatusBarController;
    static get statusBar() {
        return this._statusBar;
    }

    private static _session: CodeStreamSession;
    static get session(): CodeStreamSession {
        return this._session;
    }

    private static _streamView: StreamViewController;
    static get streamView() {
        return this._streamView;
    }

    // private static _unreadDecorator: UnreadDecorationProvider;
    // static get unreadDecorator(): UnreadDecorationProvider {
    //     return this._unreadDecorator;
    // }

    static resetConfig() {
        this._config = undefined;
    }
}
