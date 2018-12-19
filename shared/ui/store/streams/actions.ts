import { CSStream } from "../../shared/api.protocol";
import { action } from "../common";
import { StreamActionType } from "./types";

export const addStreams = (streams: CSStream[]) => action(StreamActionType.ADD_STREAMS, streams);

export const updateStream = (stream: CSStream) => action(StreamActionType.UPDATE_STREAM, stream);

export const bootstrapStreams = (streams: CSStream[]) =>
	action(StreamActionType.BOOTSTRAP_STREAMS, streams);
export const remove = (streamId: string, teamId: string) =>
	action(StreamActionType.REMOVE_STREAM, { streamId, teamId });
