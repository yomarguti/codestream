'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
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
        const streams = await this.session.getStreams(this.repository);
        return streams.map(s => new StreamNode(this.session, s));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.repository.normalizedUrl, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Repository;
        return item;
    }
}