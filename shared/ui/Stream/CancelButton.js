import React from "react";
import Icon from "./Icon";
import Tooltip from "./Tooltip";

CancelButton.defaultProps = {
	className: "",
	disabled: false,
	placement: "bottomRight"
};

export default function CancelButton({
	placement = "bottomRight",
	onClick,
	className = "cancel-icon",
	title = "",
	...extras
}) {
	const { dispatch, ...extraProps } = extras; // remove non-html attributes
	let tip = (
		<span>
			{title || "Cancel"} <span className="keybinding">ESC</span>
		</span>
	);
	return (
		<span className="align-right-button" onClick={onClick}>
			<Tooltip title={tip} placement={placement}>
				<span>
					<Icon name="x" className={className} />
				</span>
			</Tooltip>
		</span>
	);
}
