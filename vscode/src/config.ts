'use strict';

export interface BotResponse {
    message: string;
    location?: 'channel' | 'thread';
    codeBlock?: string;
}

export interface BotTrigger {
    type: 'immediate' | 'delayed' | 'hotkey';
    pattern?: string;
    response: BotResponse;
}

export enum Notifications {
    All = 'all',
    Mentions = 'mentions',
    None = 'none'
}

export enum TraceLevel {
    Silent = 'silent',
    Errors = 'errors',
    Verbose = 'verbose',
    Debug = 'debug'
}

export interface IConfig {
    autoSignIn: boolean;

    bot: {
        email: string;
        enabled: boolean;
        password: string;
        triggers: BotTrigger[];
    };

    debug: boolean;
    email: string;

    explorers: {
        enabled: boolean;
    };

    notifications: Notifications;
    password: string;
    serverUrl: string;
    team: string;
    traceLevel: TraceLevel;
}