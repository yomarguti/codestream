import React from "react";
import createClassString from "classnames";

Button.defaultProps = {
	className: "",
	disabled: false,
	loading: false
};

export default function Button({ children, className, disabled, isOffline, loading, ...extras }) {
	const { dispatch, ...extraProps } = extras; // remove non-html attributes
	return (
		<button
			className={createClassString("native-key-bindings btn inline-block-tight", className, {
				"btn-primary": true
			})}
			disabled={loading || disabled}
			{...extraProps}
		>
			{loading ? <span className="loading loading-spinner-tiny inline-block" /> : children}
		</button>
	);
}
