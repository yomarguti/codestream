import { FeatureFlagsActionType } from "./types";
import { action } from "../common";

export const setFeatureFlag = (flag: string, value: boolean) =>
	action(FeatureFlagsActionType.SetFlag, { flag, value });
