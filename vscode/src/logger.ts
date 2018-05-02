'use strict';
import { ConfigurationChangeEvent, ExtensionContext, OutputChannel, window } from 'vscode';
import { configuration, TraceLevel } from './configuration';
import { extensionOutputChannelName } from './extension';
// import { Telemetry } from './telemetry';

const ConsolePrefix = `[${extensionOutputChannelName}]`;

export class Logger {

    static debug = false;
    static level: TraceLevel = TraceLevel.Silent;
    static output: OutputChannel | undefined;

    static configure(context: ExtensionContext) {
        context.subscriptions.push(configuration.onDidChange(this.onConfigurationChanged, this));
        this.onConfigurationChanged(configuration.initializingChangeEvent);
    }

    private static onConfigurationChanged(e: ConfigurationChangeEvent) {
        const initializing = configuration.initializing(e);

        let section = configuration.name('debug').value;
        if (initializing || configuration.changed(e, section)) {
            this.debug = configuration.get<boolean>(section);
        }

        section = configuration.name('traceLevel').value;
        if (initializing || configuration.changed(e, section)) {
            this.level = configuration.get<TraceLevel>(section);

            if (this.level === TraceLevel.Silent) {
                if (this.output !== undefined) {
                    this.output.dispose();
                    this.output = undefined;
                }
            }
            else {
                this.output = this.output || window.createOutputChannel(`CodeStream`);
            }
        }
    }

    static log(message?: any, ...params: any[]): void {
        if (this.debug) {
            console.log(this.timestamp, ConsolePrefix, message, ...params);
        }

        if (this.output !== undefined && (this.level === TraceLevel.Verbose || this.level === TraceLevel.Debug)) {
            this.output.appendLine((this.debug ? [this.timestamp, message, ...params] : [message, ...params]).join(' '));
        }
    }

    static error(ex: Error, classOrMethod?: string, ...params: any[]): void {
        if (this.debug) {
            console.error(this.timestamp, ConsolePrefix, classOrMethod, ...params, ex);
        }

        if (this.output !== undefined && this.level !== TraceLevel.Silent) {
            this.output.appendLine((this.debug ? [this.timestamp, classOrMethod, ...params, ex] : [classOrMethod, ...params, ex]).join(' '));
        }

        // Telemetry.trackException(ex);
    }

    static warn(message?: any, ...params: any[]): void {
        if (this.debug) {
            console.warn(this.timestamp, ConsolePrefix, message, ...params);
        }

        if (this.output !== undefined && this.level !== TraceLevel.Silent) {
            this.output.appendLine((this.debug ? [this.timestamp, message, ...params] : [message, ...params]).join(' '));
        }
    }

    static showOutputChannel() {
        if (this.output === undefined) return;

        this.output.show();
    }

    private static get timestamp(): string {
        const now = new Date();
        return `[${now.toISOString().replace(/T/, ' ').replace(/\..+/, '')}:${('00' + now.getUTCMilliseconds()).slice(-3)}]`;
    }

    static gitOutput: OutputChannel | undefined;

    static logGitCommand(command: string, cwd: string, ex?: Error): void {
        if (this.level !== TraceLevel.Debug) return;

        if (this.gitOutput === undefined) {
            this.gitOutput = window.createOutputChannel(`CodeStream (Git)`);
        }
        this.gitOutput.appendLine(`${this.timestamp} ${command} (${cwd})${ex === undefined ? '' : `\n\n${ex.toString()}`}`);
    }
}