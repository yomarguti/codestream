'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Stream, StreamType } from '../api/session';
import { OpenStreamCommandArgs } from '../commands';
import { ExplorerNode, ResourceType } from './explorerNode';
import { Container } from '../container';

export class StreamNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly stream: Stream,
        private readonly _resourceType?: ResourceType
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${this.getContextValue()}:${this.stream.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
    }

    async getTreeItem(): Promise<TreeItem> {
        let label = await this.stream.label();
        if (label[0] === '#') {
            label = label.substr(1);
        }

        const item = new TreeItem(label, TreeItemCollapsibleState.None);
        item.contextValue = this.getContextValue();
        item.command = {
            title: 'Open Stream',
            command: 'codestream.openStream',
            arguments: [
                {
                    streamThread: { id: undefined, stream: this.stream }
                } as OpenStreamCommandArgs
            ]
        };

        if (this.stream.type === StreamType.Channel) {
            item.iconPath = {
                dark: Container.context.asAbsolutePath(`assets/images/dark/channel.svg`),
                light: Container.context.asAbsolutePath(`assets/images/light/channel.svg`)
            };
        }
        return item;
    }

    private getContextValue() {
        if (this._resourceType !== undefined) return this._resourceType;

        switch (this.stream.type) {
            case StreamType.Channel: return ResourceType.Channel;
            case StreamType.Direct: return ResourceType.DirectMessage;
            case StreamType.File: return ResourceType.FileStream;
        }
    }
}