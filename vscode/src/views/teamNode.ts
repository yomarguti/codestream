// 'use strict';
// import { TreeItem, TreeItemCollapsibleState } from 'vscode';
// import { CodeStreamSession, Team } from '../api/session';
// import { ExplorerNode, ResourceType } from './explorerNode';
// import { PeopleNode } from './peopleNode';
// import { RepositoriesNode } from './repositoriesNode';

// export class TeamNode extends ExplorerNode {

//     constructor(
//         public readonly session: CodeStreamSession,
//         private readonly team: Team
//     ) {
//         super();
//     }

//     async getChildren(): Promise<ExplorerNode[]> {
//         return [
//             new RepositoriesNode(this.session, this.team),
//             new PeopleNode(this.session, this.team)
//         ];
//     }

//     getTreeItem(): TreeItem {
//         const item = new TreeItem(this.team.name, TreeItemCollapsibleState.Expanded);
//         item.contextValue = ResourceType.Team;
//         return item;
//     }
// }
