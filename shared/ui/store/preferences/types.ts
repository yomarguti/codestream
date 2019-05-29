import { CSMePreferences } from "@codestream/protocols/api";

export interface PreferencesState extends CSMePreferences {}

export enum PreferencesActionsType {
	Update = "UPDATE_PREFERENCES",
	Set = "SET_PREFERENCES"
}
