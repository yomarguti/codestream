'use strict';
import { commands, ConfigurationChangeEvent, Disposable, Event, EventEmitter, TreeDataProvider, TreeItem, TreeView, window } from 'vscode';
import { configuration } from '../configuration';
import { Container } from '../container';
import { Context, setContext } from '../context';
import { ExplorerNode, RefreshReason, SessionNode } from './explorerNodes';

export * from './explorerNodes';

export class CodeStreamExplorer extends Disposable implements TreeDataProvider<ExplorerNode> {

    private _disposable: Disposable | undefined;
    private _roots: ExplorerNode[] = [];
    private _view: TreeView<ExplorerNode> | undefined;

    private readonly _onDidChangeTreeData = new EventEmitter<ExplorerNode>();
    public get onDidChangeTreeData(): Event<ExplorerNode> {
        return this._onDidChangeTreeData.event;
    }

    constructor() {
        super(() => this.dispose());

        // Container.explorerCommands;
        commands.registerCommand('codestream.explorer.refresh', this.refresh, this);
        commands.registerCommand('codestream.explorer.refreshNode', this.refreshNode, this);
        // commands.registerCommand('gitlens.gitExplorer.setFilesLayoutToAuto', () => this.setFilesLayout(ExplorerFilesLayout.Auto), this);
        // commands.registerCommand('gitlens.gitExplorer.setFilesLayoutToList', () => this.setFilesLayout(ExplorerFilesLayout.List), this);
        // commands.registerCommand('gitlens.gitExplorer.setFilesLayoutToTree', () => this.setFilesLayout(ExplorerFilesLayout.Tree), this);

        // commands.registerCommand('gitlens.gitExplorer.setAutoRefreshToOn', () => this.setAutoRefresh(Container.config.gitExplorer.autoRefresh, true), this);
        // commands.registerCommand('gitlens.gitExplorer.setAutoRefreshToOff', () => this.setAutoRefresh(Container.config.gitExplorer.autoRefresh, false), this);
        // commands.registerCommand('gitlens.gitExplorer.setRenameFollowingOn', () => GitExplorer.setRenameFollowing(true), this);
        // commands.registerCommand('gitlens.gitExplorer.setRenameFollowingOff', () => GitExplorer.setRenameFollowing(false), this);
        // commands.registerCommand('gitlens.gitExplorer.switchToHistoryView', () => this.switchTo(GitExplorerView.History), this);
        // commands.registerCommand('gitlens.gitExplorer.switchToRepositoryView', () => this.switchTo(GitExplorerView.Repository), this);

        // commands.registerCommand('gitlens.gitExplorer.undockHistory', this.undockHistory, this);

        Container.context.subscriptions.push(
            // window.onDidChangeActiveTextEditor(Functions.debounce(this.onActiveEditorChanged, 500), this),
            // window.onDidChangeVisibleTextEditors(Functions.debounce(this.onVisibleEditorsChanged, 500), this),
            Container.session.onDidChange(this.onSessionChanged, this),
            configuration.onDidChange(this.onConfigurationChanged, this)
        );
        this.onConfigurationChanged(configuration.initializingChangeEvent);
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private async onConfigurationChanged(e: ConfigurationChangeEvent) {
        const initializing = configuration.initializing(e);

        if (!initializing && !configuration.changed(e, configuration.name('explorer').value)) return;

        if (!initializing && configuration.changed(e, configuration.name('explorer')('enabled').value)) {
            setContext(Context.Explorer, Container.session.loggedIn && Container.config.explorer.enabled);
        }

        if (!initializing && this._roots.length !== 0) {
            this.refresh(RefreshReason.ConfigurationChanged);
        }

        if (initializing) {
            this._view = window.createTreeView('codestream', { treeDataProvider: this });
            this._disposable = this._view;
        }
    }

    private onSessionChanged() {
        this.refresh();
    }

    // private onVisibleEditorsChanged(editors: TextEditor[]) {
    //     if (this._root === undefined || this.view !== GitExplorerView.History) return;

    //     // If we have no visible editors, or no trackable visible editors reset the view
    //     if (editors.length === 0 || !editors.some(e => e.document && Container.git.isTrackable(e.document.uri))) {
    //         this.clearRoot();

    //         this.refresh(RefreshReason.VisibleEditorsChanged);
    //     }
    // }

    private _loading: Promise<void> | undefined;

    async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
        if (this._loading !== undefined) {
            await this._loading;
            this._loading = undefined;
        }

        if (node !== undefined) return node.getChildren();

        const session = await Container.session;
        if (session === undefined) return [];

        const root = new SessionNode(session);
        this._roots = await root.getChildren();
        // if (session.hasSingleTeam) {
        //     const child = (await root.getChildren())[0];
        //     this._roots = await child.getChildren();
        // }
        // else {
        //     this._roots = [root];
        // }

        return this._roots;
    }

    async getTreeItem(node: ExplorerNode): Promise<TreeItem> {
        return node.getTreeItem();
    }

    getQualifiedCommand(command: string) {
        return `codestream.explorer.${command}`;
    }

    async refresh(reason?: RefreshReason, root?: ExplorerNode) {
        if (reason === undefined) {
            reason = RefreshReason.Command;
        }

        this._onDidChangeTreeData.fire();
    }

    refreshNode(node: ExplorerNode) {
        // Since a root node won't actually refresh, force everything
        this._onDidChangeTreeData.fire(this._roots.includes(node) ? undefined : node);
    }

    refreshNodes() {
        this._roots.forEach(n => n.refresh());

        this._onDidChangeTreeData.fire();
    }
}