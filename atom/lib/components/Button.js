import React from "react";
import createClassString from "classnames";

Button.defaultProps = {
	className: "",
	disabled: false,
	loading: false
};

export default function Button({ children, className, disabled, loading, ...extras }) {
	return (
		<button
			className={createClassString("native-key-bindings btn inline-block-tight", className, {
				"btn-primary": !loading
			})}
			disabled={loading || disabled}
			{...extras}
		>
			{loading ? <span className="loading loading-spinner-tiny inline-block" /> : children}
		</button>
	);
}
