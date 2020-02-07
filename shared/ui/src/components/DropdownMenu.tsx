import React from "react";
import styled from "styled-components";
import Menu from "../../Stream/Menu";
import Icon from "@codestream/webview/Stream/Icon";

const TextButton = styled.span`
	display: inline-block;
	white-space: nowrap;
	cursor: pointer;
	color: var(--text-color-highlight);
	.octicon-chevron-down {
		display: inline-block;
		transform: scale(0.7);
		margin-left: 2px;
		margin-right: 5px;
	}
	&:focus {
		margin: -3px;
		border: 3px solid transparent;
	}
`;

export type Props = React.PropsWithChildren<{
	items: any[];
	title?: string;
	titleIcon?: any;
}>;

export function DropdownMenu(props: Props) {
	const buttonRef = React.useRef<HTMLSpanElement>(null);
	const [isOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);

	const maybeToggleMenu = action => {
		if (action !== "noop") toggleMenu(action);
	};
	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key == "Enter") return toggleMenu(event);
	};

	if (!props.items.length) {
		return <>{props.children}</>;
	}
	return (
		<>
			<TextButton ref={buttonRef} onClick={toggleMenu} tabIndex={0} onKeyPress={handleKeyPress}>
				{props.children}
				<Icon name="chevron-down" />
			</TextButton>
			{isOpen && buttonRef.current && (
				<Menu
					title={props.title}
					titleIcon={props.titleIcon}
					align="center"
					valign="bottom"
					items={props.items}
					target={buttonRef.current}
					focusOnSelect={buttonRef.current}
					action={maybeToggleMenu}
				/>
			)}
		</>
	);
}
