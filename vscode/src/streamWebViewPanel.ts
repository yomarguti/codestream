import * as fs from 'fs';
import {
  commands,
  Disposable,
  ViewColumn,
  WebviewPanel,
  window
} from 'vscode';
import { CodeStreamSession } from './api/session';
import { Container } from './container';

export class StreamWebViewPanel implements Disposable {
  private readonly _disposable: Disposable;

  constructor(public readonly session: CodeStreamSession) {
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
    const filename = Container.context.asAbsolutePath('/assets/index.html');
    const html: string = fs.readFileSync(filename, {
      encoding: 'utf-8'
    });
    panel.webview.html = html;
    panel.reveal(ViewColumn.Three);
  }
}
