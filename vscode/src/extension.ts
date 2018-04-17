'use strict';
import 'reflect-metadata';

import { ExtensionContext } from 'vscode';
import { ContextKeys, setContext } from './common';
import { IConfig } from './config';
import { configuration, Configuration } from './configuration';
import { Container } from './container';
import { Logger } from './logger';
import { SessionStatusChangedEvent } from './api/session';

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    Logger.configure(context);

    const cfg = configuration.get<IConfig>();
    await Container.initialize(context, cfg);

    context.subscriptions.push(Container.session.onDidChangeStatus(onSessionStatusChanged));

    if (cfg.username && cfg.password) {
        Container.commands.signIn();
    }
}

export async function deactivate(): Promise<void> {
}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
    const status = e.getStatus();
    setContext(ContextKeys.Status, status);
}