'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ChannelStream, CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { StreamNode } from './streamNode';
import { Iterables } from '../system';

export class ChannelsNode extends ExplorerNode {

    private readonly _childrenResourceType: ResourceType;
    private readonly _filter: (c: ChannelStream) => boolean;
    private readonly _name: string;
    private readonly _resourceType: ResourceType;

    constructor(
        public readonly session: CodeStreamSession,
        public readonly type: 'channels' | 'services'
    ) {
        super();

        switch (type) {
            case 'services':
                this._name = 'Live Share Sessions';
                this._filter = c => c.name.startsWith('ls:');
                this._resourceType = ResourceType.ServiceChannels;
                this._childrenResourceType = ResourceType.ServiceChannel;
                break;

            default:
                this._name = 'Channels';
                this._filter = c => !c.name.startsWith('vsls:') && !c.name.startsWith('ls:');
                this._resourceType = ResourceType.Channels;
                this._childrenResourceType = ResourceType.Channels;
                break;
        }
    }

    get id() {
        return `${this.session.id}:${this._resourceType}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const channels = await this.session.channels.filter(this._filter);
        return [...Iterables.map(channels, c => new StreamNode(this.session, c, this._childrenResourceType))];
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this._name, TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Channels;
        return item;
    }
}