'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Stream, StreamType } from '../api/session';
// import { Container } from '../container';
import { ExplorerNode, ResourceType } from './explorerNode';
// import { PostNode } from './postNode';

export class StreamNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly stream: Stream
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${this.getContextValue()}:${this.stream.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
        // this.subscribe();

        // return [...await this.stream.posts.map(p => new PostNode(this.session, p))];
    }

    async getTreeItem(): Promise<TreeItem> {
        // this.unsubscribe();

        const item = new TreeItem(await this.stream.label(), TreeItemCollapsibleState.None);
        item.contextValue = this.getContextValue();
        item.command = {
            title: 'Open Stream',
            command: 'codestream.openStream',
            arguments: [
                this.stream
            ]
        };
        return item;
    }
    // protected subscribe() {
    //     this.subscriptions.push(this.stream.posts.onDidChange(this.onChanged, this));
    // }

    // private onChanged() {
    //     Container.explorer.refreshNode(this);
    // }

    private getContextValue() {
        switch (this.stream.type) {
            case StreamType.Channel: return ResourceType.Channel;
            case StreamType.Direct: return ResourceType.DirectMessage;
            case StreamType.File: return ResourceType.FileStream;
        }
    }
}