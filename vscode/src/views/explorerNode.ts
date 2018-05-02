'use strict';
import { Disposable, TreeItem, TreeItemCollapsibleState } from 'vscode';

export enum RefreshReason {
    ActiveEditorChanged = 'active-editor-changed',
    AutoRefreshChanged = 'auto-refresh-changed',
    Command = 'command',
    ConfigurationChanged = 'configuration',
    NodeCommand = 'node-command',
    RepoChanged = 'repo-changed',
    ViewChanged = 'view-changed',
    VisibleEditorsChanged = 'visible-editors-changed'
}

export enum ContextValue {
    Channel = 'codestream:channel',
    Channels = 'codestream:channels',
    ServiceChannel = 'codestream:channel:service',
    ServiceChannels = 'codestream:channels:service',
    DirectMessage = 'codestream:directMessage',
    FileStream = 'codestream:fileStream',
    Message = 'codestream:message',
    People = 'codestream:people',
    Post = 'codestream:post',
    PostWithCode = 'codestream:post:code',
    Repositories = 'codestream:repositories',
    Repository = 'codestream:repository',
    Session = 'codestream:session',
    Team = 'codestream:team',
    User = 'codestream:user',
    CurrentUser = 'codestream:user:current'
}

export abstract class ExplorerNode extends Disposable {

    constructor() {
        super(() => this.dispose());
    }

    dispose() { }
    abstract getChildren(): ExplorerNode[] | Promise<ExplorerNode[]>;
    abstract getTreeItem(): TreeItem | Promise<TreeItem>;
    refresh(): void {}
}

export abstract class SubscribableExplorerNode extends ExplorerNode {

    constructor() {
        super();
    }

    dispose() {
        this.unsubscribe();
    }

    abstract get id(): string;

    protected abstract subscribe(): void;
    protected unsubscribe() {
        if (this._subscriptions !== undefined) {
            this._subscriptions.forEach(d => d.dispose());
            this._subscriptions = undefined;
        }
    }

    private _subscriptions: Disposable[] | undefined;
    protected get subscriptions() {
        if (this._subscriptions === undefined) {
            this._subscriptions = [];
        }
        return this._subscriptions;
    }
}

export class MessageNode extends ExplorerNode {

    constructor(
        private readonly message: string,
        private readonly tooltip?: string
    ) {
        super();
     }

    getChildren(): ExplorerNode[] | Promise<ExplorerNode[]> {
        return [];
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        const item = new TreeItem(this.message, TreeItemCollapsibleState.None);
        item.contextValue = ContextValue.Message;
        item.tooltip = this.tooltip;
        return item;
    }
}