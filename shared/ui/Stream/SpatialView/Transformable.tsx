import { ReactNode } from "react";
import React from "react";

function useUpdates(effect: () => void, deps: any[]) {
	const initialMountRef = React.useRef(true);

	React.useEffect(initialMountRef.current ? () => (initialMountRef.current = false) : effect, deps);
}

export function Transformable(props: { children: ReactNode | ReactNode[] }) {
	React.useEffect(() => {
		console.log("Transformable mounted");

		return () => {
			debugger;
			console.log("Transformable unmounted");
		};
	}, []);

	useUpdates(() => {
		console.log("effect for children updates");
		debugger;
	}, [props.children]);

	return <React.Fragment>{props.children}</React.Fragment>;
}
