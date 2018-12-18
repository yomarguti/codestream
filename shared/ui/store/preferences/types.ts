import { CSMePreferences } from "../../shared/api.protocol";

export interface State extends CSMePreferences {}

export enum PreferencesActionsType {
	Update = "UPDATE_PREFERENCES"
}
