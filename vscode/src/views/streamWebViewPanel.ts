import * as fs from 'fs';
import {
  commands,
  Disposable,
  ViewColumn,
  WebviewPanel,
  window
} from 'vscode';
import { CodeStreamSession } from '../api/session';
import { Container } from '../container';

interface ViewData {
  currentTeamId: string;
  currentRepoId: string;
  currentUserId: string;
  currentCommit?: string;
  currentFile?: string;
  posts: any[];
  streams: any[];
  teams: any[];
  users: any[];
  repos: any[];
}

export class StreamWebViewPanel implements Disposable {
  private readonly _disposable: Disposable;

  constructor(private session: CodeStreamSession) {
    this._disposable = Disposable.from(
      commands.registerCommand('codestream.openStream', this.openStream, this)
    );
  }

  dispose() {
    this._disposable.dispose();
  }

  private openStream() {
    const panel: WebviewPanel = window.createWebviewPanel(
      'CodeStream.stream',
      'CodeStream',
      ViewColumn.Three,
      {
        retainContextWhenHidden: true,
        enableFindWidget: true,
        enableCommandUris: true,
        enableScripts: true
      }
    );

    const repoId = '5ab166db782e39419e62b72a';
    const teamId = '5aac01126133144a418dc6ac';
    const state: ViewData = Object.create(null);
    this.session.api.getPosts('5ac39c387b22645d6aa5f2ea', teamId).then(posts => {
      state.posts = posts;
      state.currentRepoId = repoId;
      state.currentFile = 'styles.css';
      state.currentTeamId = teamId;
      state.currentUserId = this.session.userId;
      return this.session.api.getUsers(teamId);
    }).then(users => {
      state.users = users;
      return this.session.api.getRepo(repoId);
    }).then(repo => {
      state.repos = [repo];
      return this.session.api.getStreams(repo);
    }).then(streams => {
      state.streams = streams;
      state.teams = this.session.teams;
    }).then(() => {
      console.log(state);
      const filename = Container.context.asAbsolutePath('/assets/index.html');
      const html: string = fs.readFileSync(filename, {
        encoding: 'utf-8'
      }).replace('{%%}', JSON.stringify(state));
      panel.webview.html = html;
    });
  }
}
