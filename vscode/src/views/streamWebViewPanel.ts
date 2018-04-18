import {
  Disposable,
  ViewColumn,
  Webview,
  WebviewPanel,
  window
} from 'vscode';
import { CSPost, CSRepository, CSStream, CSTeam, CSUser } from '../api/api';
import { CodeStreamSession, Stream, StreamType } from '../api/session';
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
    session.onDidReceivePosts(event => {
      view.postMessage({
        type: 'posts',
        payload: event.getPosts().map(post => (
          { ...post.entity, id: post.id }
        ))
      });
    });
  }
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

    const messageRelay = new MessageRelay(this.session, panel.webview);
    messageRelay;

    const state: ViewData = Object.create(null);

    let streamsFn: () => Promise<CSStream[]>;
    switch (stream.type) {
      case StreamType.Channel:
        // Dunno what to pass here
        state.currentRepoId = (await this.session.repos.first()).id;
        state.currentFile = stream.name;
        streamsFn = () => this.session.channels.entities;
        break;
      case StreamType.Direct:
        // Dunno what to pass here
        state.currentRepoId = (await this.session.repos.first()).id;
        state.currentFile = stream.name;
        streamsFn = () => this.session.directMessages.entities;
        break;
      case StreamType.File:
        state.currentRepoId = stream.repoId;
        state.currentFile = stream.path;
        streamsFn = async () => (await stream.repo).streams.entities;
        break;
      default:
        throw new Error('Invalid stream type');
    }
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
      streamsFn(),
      this.session.teams.entities,
      this.session.users.entities
    ]);

    const htmlPath = Container.context.asAbsolutePath('/assets/index.html');
    const scriptPath = Container.context.asAbsolutePath('/assets/app.js');
    const stylesPath = Container.context.asAbsolutePath('/assets/styles/stream.css');
    const html: string = fs.readFileSync(htmlPath, {
      encoding: 'utf-8'
    })
    .replace('{% bootstrap-data %}', JSON.stringify(state))
    .replace('{% script-path %}', scriptPath)
    .replace('{% styles-path %}', stylesPath);
    panel.webview.html = html;
  }
}
