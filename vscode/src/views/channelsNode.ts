'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { StreamNode } from './streamNode';

export class ChannelsNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.Channels}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [...await this.session.channels.items()]
            .map(c => new StreamNode(this.session, c));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('Channels', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Channels;
        return item;
    }
}