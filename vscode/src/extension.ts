'use strict';
import 'reflect-metadata';

import { commands, ExtensionContext, MessageItem, window } from 'vscode';
import { IConfig, TraceLevel } from './config';
import { configuration, Configuration } from './configuration';
import { Container } from './container';
import { Context, setContext } from './context';
import { SessionStatus, SessionStatusChangedEvent } from './api/session';
import { Logger } from './logger';

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    Logger.configure(context);

    const cfg = configuration.get<IConfig>();
    await Container.initialize(context, cfg);

    context.subscriptions.push(Container.session.onDidChangeStatus(onSessionStatusChanged));

    if (cfg.username && cfg.password) {
        attemptLogin(cfg.username, cfg.password);
    }

    commands.registerCommand('codestream.signIn', () => {
        const cfg = configuration.get<IConfig>();
        attemptLogin(cfg.username, cfg.password);
    });

    commands.registerCommand('codestream.signOut', () => Container.session.logout());

    commands.registerCommand('codestream.post', async () => {
        const message = await window.showInputBox({ prompt: 'Enter message', placeHolder: 'Message' });
        if (message === undefined) return;

        Container.session.post(message);
    });
}

export async function deactivate(): Promise<void> {
}

async function attemptLogin(username: string, password: string) {
    try {
        await Container.session.login(username, password);
    }
    catch (ex) {
        const actions: MessageItem[] = [
            { title: 'Retry' }
        ];

        const tracing = Container.config.traceLevel !== TraceLevel.Silent;
        if (tracing) {
            actions.push({ title: 'Open Output Channel' });
        }

        const result = await window.showErrorMessage(`Unable to sign into CodeStream${!tracing ? '' : '\nSee the CodeStream output channel for more details'}`, ...actions);
        if (result === undefined) throw ex;

        if (result === actions[0]) {
            setImmediate(() => attemptLogin(username, password));
        }
        else if (result === actions[1]) {
            Logger.showOutputChannel();
        }
    }
}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
    const signedIn = e.getStatus() === SessionStatus.SignedIn;
    setContext(Context.Enabled, signedIn);
    setContext(Context.Explorer, signedIn && Container.config.explorer.enabled);
}