'use strict';
import 'reflect-metadata';

export const ExtensionId = 'codestream';
export const ExtensionOutputChannelName = 'CodeStream';
export const QualifiedExtensionId = `CodeStream.${ExtensionId}`;

import { ExtensionContext, extensions } from 'vscode';
import { ContextKeys, setContext } from './common';
import { IConfig } from './config';
import { configuration, Configuration } from './configuration';
import { Container } from './container';
import { Logger } from './logger';
import { SessionStatusChangedEvent } from './api/session';

const extension = extensions.getExtension(QualifiedExtensionId)!;
export const extensionVersion = extension.packageJSON.version;

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