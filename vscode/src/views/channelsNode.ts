'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ChannelStream, CodeStreamSession } from '../api/session';
import { ContextValue, ExplorerNode } from './explorerNode';
import { StreamNode } from './streamNode';
import { Iterables } from '../system';

export class ChannelsNode extends ExplorerNode {

    private readonly _childrenResourceType: ContextValue;
    private readonly _filter: (c: ChannelStream) => boolean;
    private readonly _name: string;
    private readonly _resourceType: ContextValue;

    constructor(
        public readonly session: CodeStreamSession,
        public readonly type: 'channels' | 'services'
    ) {
        super();

        switch (type) {
            case 'services':
                this._name = 'Live Share Sessions';
                this._filter = c => c.name.startsWith('ls:');
                this._resourceType = ContextValue.ServiceChannels;
                this._childrenResourceType = ContextValue.ServiceChannel;
                break;

            default:
                this._name = 'Channels';
                this._filter = c => !c.name.startsWith('vsls:') && !c.name.startsWith('ls:');
                this._resourceType = ContextValue.Channels;
                this._childrenResourceType = ContextValue.Channel;
                break;
        }
    }

    get id() {
        return `${this.session.id}:${this._resourceType}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const channels = Iterables.filter(await this.session.channels.filter(this._filter), s => !s.hidden);
        return [...Iterables.map(channels, c => new StreamNode(this.session, c, this._childrenResourceType))];
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this._name, TreeItemCollapsibleState.Expanded);
        item.contextValue = ContextValue.Channels;
        return item;
    }
}