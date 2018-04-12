'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamRepository, CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { StreamNode } from './streamNode';

export class RepositoryNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly repository: CodeStreamRepository
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return Array.from(await this.repository.streams.items)
            .map(s => new StreamNode(this.session, s));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.repository.url, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Repository;
        return item;
    }
}