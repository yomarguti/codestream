import { BootstrapActionType } from "./types";
import { action } from "../common";

export const setBootstrapped = (state: boolean) =>
	action(state ? BootstrapActionType.Complete : BootstrapActionType.Start);
