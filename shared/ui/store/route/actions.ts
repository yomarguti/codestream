import { action } from "../common";
import { RouteActionsType } from "./types";

export const goToCompleteSignup = (params = {}) => action(RouteActionsType.CompleteSignup, params);

export const goToSignup = (params = {}) => action(RouteActionsType.Signup, params);

export const goToLogin = (params = {}) => action(RouteActionsType.Login, params);
