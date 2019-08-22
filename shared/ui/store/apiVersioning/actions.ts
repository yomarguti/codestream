import { action } from "../common";
import { ApiVersioningActionsType } from "./types";

export const apiUpgradeRecommended = () => action(ApiVersioningActionsType.ApiUpgradeRecommended);
export const apiUpgradeRequired = () => action(ApiVersioningActionsType.ApiUpgradeRequired);
export const apiUpgradeRecommendedDismissed = () => action(ApiVersioningActionsType.ApiOk);
