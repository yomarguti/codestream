'use strict';

export interface BotResponse {
    message: string;
    location: 'channel' | 'thread';
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
    debug: boolean;

    bot: {
        enabled: boolean;
        username: string;
        password: string;
        triggers: { message: string, response: BotResponse }[];
    };

    explorers: {
        enabled: boolean;
    };

    notifications: Notifications;
    password: string;
    serverUrl: string;
    teamId: string;
    traceLevel: TraceLevel;
    username: string;
}