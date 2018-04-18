import {
  commands,
  Disposable,
  ViewColumn,
  Webview,
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

class MessageRelay {
  constructor(private readonly session: CodeStreamSession, private readonly view: Webview) {
    session.onDidReceivePosts(posts => {
      view.postMessage({type: 'posts', payload: posts.getPosts().map(p => p.entity)});
    });
  }
}

export class StreamWebViewPanel implements Disposable {
  // private readonly _disposable: Disposable;
  private panel?: WebviewPanel;
  private messageRelay?: MessageRelay;

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

    this.messageRelay = new MessageRelay(this.session, panel.webview);

    const state: ViewData = Object.create(null);
    state.currentRepoId = stream.repoId;
    state.currentFile = stream.path;
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

    const filename = Container.context.asAbsolutePath('/assets/index.html');
    const html: string = fs.readFileSync(filename, {
      encoding: 'utf-8'
    }).replace('{%%}', JSON.stringify(state));
    panel.webview.html = html;
  }
}
