import {
  commands,
  Disposable,
  ViewColumn,
  WebviewPanel,
  window
} from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Stream } from '../api/session';
import { Container } from '../container';
import * as fs from 'fs';

interface ViewData {
  currentTeamId: string;
  currentRepoId: string;
  currentUserId: string;
  currentCommit?: string;
  currentFile?: string;
  posts: CSPost[];
  streams: CSStream[];
  teams: CSTeam[];
  users: CSUser[];
  repos: CSRepository[];
}

export class StreamWebViewPanel implements Disposable {
  // private readonly _disposable: Disposable;

  constructor(private session: CodeStreamSession) {
    // this._disposable = Disposable.from(
    //   commands.registerCommand('codestream.openStream', this.openStream, this)
    // );
  }

  dispose() {
    // this._disposable.dispose();
  }

  async openStream(stream: Stream) {
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

    const state: ViewData = Object.create(null);
    state.currentRepoId = stream.repoId;
    state.currentFile = stream.uri.fsPath;
    state.currentTeamId = stream.teamId;
    state.currentUserId = this.session.userId;

    [
      state.posts,
      state.repos,
      state.streams,
      state.teams,
      state.users
    ] = await Promise.all([
      stream.posts.entities,
      this.session.repos.entities,
      this.session.streams.entities,
      this.session.teams.entities,
      this.session.users.entities
    ]);

    console.log(state);
    const filename = Container.context.asAbsolutePath('/assets/index.html');
    const html: string = fs.readFileSync(filename, {
      encoding: 'utf-8'
    }).replace('{%%}', JSON.stringify(state));
    panel.webview.html = html;

    panel.reveal(ViewColumn.Three);
  }
}
