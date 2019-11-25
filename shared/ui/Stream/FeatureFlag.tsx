import { CodeStreamState } from "../store";
import { useSelector } from "react-redux";
import { FlaggedFeature } from "../store/featureFlags/types";

type RenderFunction = (flagEnabled: boolean) => React.ReactNode;

export function FeatureFlag(props: { flag: FlaggedFeature; children: RenderFunction }) {
	const flagEnabled = useSelector((state: CodeStreamState) =>
		Boolean(state.featureFlags[props.flag])
	);

	return props.children(flagEnabled);
}
