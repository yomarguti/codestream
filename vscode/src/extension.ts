'use strict';
import 'reflect-metadata';

export const extensionId = 'codestream';
export const extensionOutputChannelName = 'CodeStream';
export const qualifiedExtensionId = `CodeStream.${extensionId}`;
// HACK: THIS IS SOOOO BAD
export const encryptionKey = '3d7e8d4f-63c9-44ee-a1e9-9530c243447e';

import { ExtensionContext, extensions } from 'vscode';
// import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { ContextKeys, setContext } from './common';
import { configuration, Configuration, IConfig } from './configuration';
import { Container } from './container';
import { Logger } from './logger';
import { SessionStatusChangedEvent } from './api/session';
// import * as path from 'path';

const extension = extensions.getExtension(qualifiedExtensionId)!;
export const extensionVersion = extension.packageJSON.version;

export async function activate(context: ExtensionContext) {
    Configuration.configure(context);
    Logger.configure(context);

    const cfg = configuration.get<IConfig>();
    await Container.initialize(context, cfg);

    // // The debug options for the server
    // // const args = ['--nolazy', '--debug=6009'];

    // const server = context.asAbsolutePath(path.join('../codestream-daemon', 'codestream-daemon.exe'));
    // // If the extension is launched in debug mode then the debug server options are used
    // // Otherwise the run options are used
    // const serverOptions: ServerOptions = {
    //     run: {
    //         command: server
    //     },
    //     debug: {
    //         command: server
    //         // args
    //     }
    // };

    // // Options to control the language client
    // const clientOptions: LanguageClientOptions = {
    //     // Register the server for plain text documents
    //     documentSelector: [{ scheme: 'file', language: '*' }],
    //     synchronize: {
    //         // Synchronize the setting section 'codestream' to the server
    //         configurationSection: 'codestream'
    //         // // Notify the server about file changes to '.clientrc' files contain in the workspace
    //         // fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    //     }
    // };

    // const client = new LanguageClient('codestream', 'CodeStream', serverOptions, clientOptions);

    context.subscriptions.push(
        // Create the language client and start the client
        // client.start(),
        Container.session.onDidChangeStatus(onSessionStatusChanged)
    );

    // await client.onReady();

    // const response = await client.sendRequest('configuration', {});
    // response;

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