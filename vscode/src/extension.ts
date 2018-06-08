'use strict';
import 'reflect-metadata';

import { ExtensionContext, extensions } from 'vscode';
import { ContextKeys, setContext } from './common';
import { Config, configuration, Configuration } from './configuration';
import { extensionQualifiedId } from './constants';
import { Container } from './container';
import { Logger } from './logger';
import { SessionStatusChangedEvent } from './api/session';

const extension = extensions.getExtension(extensionQualifiedId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    Logger.configure(context);

    const cfg = configuration.get<Config>();
    await Container.initialize(context, cfg);

    context.subscriptions.push(
        Container.session.onDidChangeStatus(onSessionStatusChanged)
    );

    if (cfg.autoSignIn) {
        Container.commands.signIn();
    }
}

export async function deactivate(): Promise<void> {
}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
    const status = e.getStatus();
    setContext(ContextKeys.Status, status);
}
