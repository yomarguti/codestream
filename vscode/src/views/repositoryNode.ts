'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Iterables } from '../system';
import { CodeStreamSession, Repository } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { StreamNode } from './streamNode';

export class RepositoryNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly repository: Repository
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const streams = await this.repository.streams.items;
        return Array.from(Iterables.map(streams, s => new StreamNode(this.session, s)));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.repository.url, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Repository;
        return item;
    }
}