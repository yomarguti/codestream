'use strict';
import 'reflect-metadata';

import { commands, ExtensionContext, window } from 'vscode';
import { IConfig } from './config';
import { configuration, Configuration } from './configuration';
import { Container } from './container';
import { Context, setContext } from './context';
import { SessionStatus, SessionStatusChangedEvent } from './api/session';

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    const cfg = configuration.get<IConfig>();
    await Container.initialize(context, cfg);

    context.subscriptions.push(Container.session.onDidChangeStatus(onSessionStatusChanged));

    if (cfg.username && cfg.password) {
        attemptLogin(cfg.username, cfg.password);
    }

    commands.registerCommand('codestream.login', () => {
        const cfg = configuration.get<IConfig>();
        attemptLogin(cfg.username, cfg.password);
    });

    // commands.registerCommand('codestream.post', async () => {
    //     const message = await window.showInputBox({ prompt: 'Enter message', placeHolder: 'Message' });
    //     Container.session.createPost(message);
    // });

    // commands.registerCommand('codestream.streams', async () => {
    //     // session.
    //     // const streams = await Container.server.sendRequest('streams', {});
    //     // streams;
    // });

    // commands.registerCommand('codestream.users', async () => {
    //     // const users = await Container.server.sendRequest('users', {});
    //     // users;
    // });
}

export async function deactivate(): Promise<void> {
}

async function attemptLogin(username: string, password: string) {
    try {
        await Container.session.login(username, password);
    }
    catch (ex) {
        debugger;
    }
}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
    const signedIn = e.getStatus() === SessionStatus.SignedIn;
    setContext(Context.Enabled, signedIn);
    setContext(Context.Explorer, signedIn && Container.config.explorer.enabled);
}