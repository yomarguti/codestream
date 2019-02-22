import { action } from "../common";
import { RouteActionsType } from "./types";

export const reset = () => action("RESET");

export const goToCompleteSignup = (params = {}) => action(RouteActionsType.CompleteSignup, params);

export const goToSignup = (params = {}) => action(RouteActionsType.Signup, params);

export const goToLogin = (params = {}) => action(RouteActionsType.Login, params);

export const goToSlackInfo = () => action(RouteActionsType.SlackInfo);
