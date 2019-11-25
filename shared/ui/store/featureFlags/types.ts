const FLAGGED_FEATURES = ["sharing"] as const;

export type FlaggedFeature = typeof FLAGGED_FEATURES[number];

export type FeatureFlagsState = Record<FlaggedFeature, boolean>;

export enum FeatureFlagsActionType {
	SetFlag = "@featureFlags/SetFlag"
}
