'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, StreamType, User } from '../api/session';
import { OpenStreamCommandArgs } from '../commands';
import { Container } from '../container';
import { ExplorerNode, ResourceType } from './explorerNode';

export class UserNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly user: User
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.User}:${this.user.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(`${this.user.name}${this.user.id === this.session.userId ? ' (you)' : ''}`, TreeItemCollapsibleState.None);
        item.id = this.id;
        item.contextValue = ResourceType.User;
        item.iconPath = Container.context.asAbsolutePath(`assets/images/presence-online.svg`);

        item.command = {
            title: 'Open Stream',
            command: 'codestream.openStream',
            arguments: [
                {
                    streamThread: {
                        type: StreamType.Direct,
                        members: [this.session.userId, this.user.id],
                        create: true
                    }
                } as OpenStreamCommandArgs
            ]
        };

        return item;
    }
}