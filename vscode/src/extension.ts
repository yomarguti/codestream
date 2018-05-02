'use strict';
import 'reflect-metadata';

export const extensionId = 'codestream';
export const extensionOutputChannelName = 'CodeStream';
export const qualifiedExtensionId = `CodeStream.${extensionId}`;
// HACK: THIS IS SOOOO BAD
export const encryptionKey = '3d7e8d4f-63c9-44ee-a1e9-9530c243447e';

import { ExtensionContext, extensions } from 'vscode';
import { ContextKeys, setContext } from './common';
import { configuration, Configuration, IConfig } from './configuration';
import { Container } from './container';
import { Logger } from './logger';
import { SessionStatusChangedEvent } from './api/session';

const extension = extensions.getExtension(qualifiedExtensionId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    Logger.configure(context);

    const cfg = configuration.get<IConfig>();
    await Container.initialize(context, cfg);

    context.subscriptions.push(Container.session.onDidChangeStatus(onSessionStatusChanged));

    if (cfg.email && cfg.password) {
        Container.commands.signIn();
    }
}

export async function deactivate(): Promise<void> {
}

function onSessionStatusChanged(e: SessionStatusChangedEvent) {
    const status = e.getStatus();
    setContext(ContextKeys.Status, status);
}