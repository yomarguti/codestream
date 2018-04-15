'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { Container } from '../container';
import { ExplorerNode, ResourceType, SubscribableExplorerNode } from './explorerNode';
import { RepositoryNode } from './repositoryNode';

export class RepositoriesNode extends SubscribableExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.Repositories}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.subscribe();

        return [...await this.session.repos.items]
            .map(r => new RepositoryNode(this.session, r));
    }

    getTreeItem(): TreeItem {
        this.unsubscribe();

        const item = new TreeItem('Repositories', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Repositories;
        return item;
    }

    protected subscribe() {
        this.subscriptions.push(this.session.repos.onDidChange(this.onChanged, this));
    }

    private onChanged() {
        Container.explorer.refreshNode(this);
    }
}