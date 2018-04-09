'use strict';
import { Command, Disposable, TreeItem, TreeItemCollapsibleState } from 'vscode';

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

export enum ResourceType {
    Message = 'codestream:message',
    People = 'codestream:people',
    Post = 'codestream:post',
    Repositories = 'codestream:repositories',
    Repository = 'codestream:repository',
    Session = 'codestream:session',
    Stream = 'codestream:stream',
    Team = 'codestream:team',
    User = 'codestream:user'
}

export abstract class ExplorerNode extends Disposable {

    readonly supportsPaging: boolean = false;
    maxCount: number | undefined;

    protected children: ExplorerNode[] | undefined;
    protected disposable: Disposable | undefined;

    constructor() {
        super(() => this.dispose());
    }

    dispose() {
        if (this.disposable !== undefined) {
            this.disposable.dispose();
            this.disposable = undefined;
        }

        // this.resetChildren();
    }

    abstract getChildren(): ExplorerNode[] | Promise<ExplorerNode[]>;
    abstract getTreeItem(): TreeItem | Promise<TreeItem>;

    getCommand(): Command | undefined {
        return undefined;
    }

    refresh(): void { }

    // resetChildren(): void {
    //     if (this.children !== undefined) {
    //         this.children.forEach(c => c.dispose());
    //         this.children = undefined;
    //     }
    // }
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
        item.contextValue = ResourceType.Message;
        item.tooltip = this.tooltip;
        return item;
    }
}