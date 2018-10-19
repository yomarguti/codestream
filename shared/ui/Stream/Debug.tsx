import * as React from "react";
import { connect } from "react-redux";
import Tooltip from "../Stream/Tooltip";

interface Props {
	children: JSX.Element;
	enabled: boolean;
	text: string;
}

function Debug(props: Props) {
	if (props.enabled) {
		return (
			<Tooltip placement="right" title={props.text} delay={0.5}>
				<span>{props.children}</span>
			</Tooltip>
		);
	} else return props.children;
}

const mapStateToProps = (state: any) => ({ enabled: state.configs.debug });
export default connect(mapStateToProps)(Debug);
