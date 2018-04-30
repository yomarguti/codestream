'use strict';
import { commands, ConfigurationChangeEvent, Disposable, Event, EventEmitter, TreeDataProvider, TreeItem, TreeView, window } from 'vscode';
import { configuration } from '../configuration';
import { Container } from '../container';
import { ExplorerNode, PeopleNode, RefreshReason, RepositoriesNode, StreamNode } from './explorerNodes';
import { ChannelsNode } from './channelsNode';

export * from './explorerNodes';

export abstract class CodeStreamExplorer extends Disposable implements TreeDataProvider<ExplorerNode> {

    private _disposable: Disposable | undefined;
    private _roots: ExplorerNode[] = [];
    private _view: TreeView<ExplorerNode> | undefined;

    private readonly _onDidChangeTreeData = new EventEmitter<ExplorerNode>();
    public get onDidChangeTreeData(): Event<ExplorerNode> {
        return this._onDidChangeTreeData.event;
    }

    constructor() {
        super(() => this.dispose());

        commands.registerCommand(this.getQualifiedCommand('refresh'), this.refresh, this);
        commands.registerCommand(this.getQualifiedCommand('refreshNode'), this.refreshNode, this);

        commands.registerCommand(this.getQualifiedCommand('hideStream'), this.hideStream, this);

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

        if (!initializing && this._roots.length !== 0) {
            this.refresh(RefreshReason.ConfigurationChanged);
        }

        if (initializing) {
            this._view = window.createTreeView(this.id, { treeDataProvider: this });
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

    abstract get id(): string;
    abstract getRoot(): ExplorerNode;

    getQualifiedCommand(command: string) {
        return `${this.id}.${command}`;
    }

    private _loading: Promise<void> | undefined;

    async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
        if (this._loading !== undefined) {
            await this._loading;
            this._loading = undefined;
        }

        if (node !== undefined) return node.getChildren();

        const session = await Container.session;
        if (session === undefined) return [];

        const root = this.getRoot(); // new SessionNode(session);
        this._roots = await root.getChildren();

        return this._roots;
    }

    async getTreeItem(node: ExplorerNode): Promise<TreeItem> {
        return node.getTreeItem();
    }

    hideStream(node: StreamNode) {
        if (!(node instanceof StreamNode)) return;

        node.stream.hide();
        this.refresh();
    }

    refresh(reason?: RefreshReason, root?: ExplorerNode) {
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

    show() {
        return Container.commands.showActivity();
    }
}

export class ChannelsExplorer extends CodeStreamExplorer {

    get id() {
        return 'codestream.channels';
    }

    getRoot() {
        return new ChannelsNode(Container.session, 'channels');
    }
}

export class LiveShareExplorer extends CodeStreamExplorer {

    get id() {
        return 'codestream.liveshare';
    }

    getRoot() {
        return new ChannelsNode(Container.session, 'services');
    }
}

export class PeopleExplorer extends CodeStreamExplorer {

    get id() {
        return 'codestream.people';
    }

    getRoot() {
        return new PeopleNode(Container.session);
    }
}

export class RepositoriesExplorer extends CodeStreamExplorer {

    get id() {
        return 'codestream.repositories';
    }

    getRoot() {
        return new RepositoriesNode(Container.session);
    }
}
