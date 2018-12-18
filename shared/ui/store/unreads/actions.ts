import { action } from "../common";
import { State } from "./types";

export const updateUnreads = (data: State) => action("UPDATE_UNREADS", data);
