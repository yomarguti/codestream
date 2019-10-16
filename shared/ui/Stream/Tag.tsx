import React from "react";
import createClassString from "classnames";
import Tooltip, { Placement } from "./Tooltip";

interface Props {
	title?: string | JSX.Element | undefined;
	placement?: Placement;
	align?: any;
	style?: any;
	delay?: number;
	className?: string;
	onClick?(event: React.SyntheticEvent): any;
	tag?: any;
}

const Tag = React.forwardRef<any, Props>((props, ref) => {
	const { tag } = props;

	let tagDiv;
	if (tag.color.startsWith("#"))
		tagDiv = (
			<div key={tag.id} className="cs-tag" style={{ background: tag.color }}>
				<div>&nbsp;{tag.label}&nbsp;</div>
			</div>
		);
	else
		tagDiv = (
			<div key={tag.id} className={`cs-tag ${tag.color}-background`}>
				<div>&nbsp;{tag.label}&nbsp;</div>
			</div>
		);

	if (props.title) {
		const { title, placement, align, delay } = props;
		return (
			<Tooltip content={title} placement={placement} align={align} delay={delay}>
				{tagDiv}
			</Tooltip>
		);
	} else return tagDiv;
});

Tag.defaultProps = {
	className: "",
	onClick: event => event.preventDefault()
};

export default Tag;
