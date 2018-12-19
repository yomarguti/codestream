import { action } from "../common";
import { PreferencesActionsType, State } from "./types";

export { reset } from "../actions";

export const updatePreferences = (preferences: Partial<State>) =>
	action(PreferencesActionsType.Update, preferences);
