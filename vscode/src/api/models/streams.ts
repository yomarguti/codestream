'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamRepository } from './repositories';
import { CodeStreamSession } from '../session';
import { Stream } from '../types';

export class CodeStreamStream extends CodeStreamItem<Stream> {

    constructor(
        session: CodeStreamSession,
        stream: Stream
    ) {
        super(session, stream);
    }

    get repoId() {
        return this.entity.repoId;
    }

    get teamId() {
        return this.entity.teamId;
    }

    get url() {
        return this.entity.file;
    }
}

export class CodeStreamStreams extends CodeStreamCollection<CodeStreamStream, Stream> {

    constructor(
        session: CodeStreamSession,
        public readonly repo: CodeStreamRepository
    ) {
        super(session);
    }

    protected getEntities() {
        return this.session.getStreams(this.repo.id);
    }

    protected mapper(e: Stream) {
        return new CodeStreamStream(this.session, e);
    }
}

