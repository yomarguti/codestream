import { action } from "../common";
import { PreferencesActionsType, State } from "./types";

export const updatePreferences = (preferences: Partial<State>) =>
	action(PreferencesActionsType.Update, preferences);
