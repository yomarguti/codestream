// 'use strict';
// import { Disposable, Event, EventEmitter, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
// import { Git, GitRepository } from './git';

// export class GitRepositoriesTracker extends Disposable {

//     private readonly _disposable: Disposable;
//     // private _repositories: Promise<GitRepository[]>;

//     private _onDidChangeRepositories = new EventEmitter<void>();
//     get onDidChangeRepositories(): Event<void> {
//         return this._onDidChangeRepositories.event;
//     }

//     constructor(
//         private readonly git: Git
//     ) {
//         super(() => this.dispose());

//         // this._repositories = this.git.getRepositories();
//         this._disposable = Disposable.from(
//             workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this)
//         );
//     }

//     dispose() {
//         this._disposable && this._disposable.dispose();
//     }

//     private async onWorkspaceFoldersChanged(e: WorkspaceFoldersChangeEvent) {
//         // TODO: Use more robust code from GitLens
//         // this._repositories = this.git.getRepositories();
//         this._onDidChangeRepositories.fire();
//     }

//     getRepositories(): Promise<GitRepository[]> {
//         return this.git.getRepositories();
//     }
// }
