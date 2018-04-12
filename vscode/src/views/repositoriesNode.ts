'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { RepositoryNode } from './repositoryNode';

export class RepositoriesNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    get id() {
        return `repositories:${this.session.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return Array.from(await this.session.repos.items)
            .map(r => new RepositoryNode(this.session, r));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('Repositories', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Repositories;
        return item;
    }
}