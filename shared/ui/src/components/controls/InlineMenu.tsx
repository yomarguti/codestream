import React from "react";
import Menu from "../../../Stream/Menu";
import styled from "styled-components";
import Icon from "../../../Stream/Icon";

interface MenuItem {
	label: string;
	action?: string | (() => void);
	key?: string;
	default?: boolean;
}

export interface InlineMenuProps {
	items: MenuItem[];
	value: string;
	onChange?: (item: MenuItem) => void;
	title?: string;
	titleIcon?: any;
}

const TextButton = styled.span`
	color: ${props => props.theme.colors.textHighlight};
	cursor: pointer;
	.octicon-chevron-down {
		transform: scale(0.7);
		margin-left: 2px;
		margin-right: 5px;
	}
	&:focus {
		margin: -3px;
		border: 3px solid transparent;
	}
`;

export function InlineMenu(props: InlineMenuProps) {
	const buttonRef = React.useRef<HTMLSpanElement>(null);
	const [isOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key == "Enter") return toggleMenu(event);
	};

	const maybeToggleMenu = action => {
		if (action !== "noop") toggleMenu(action);
	};

	return (
		<>
			{isOpen && buttonRef.current && (
				<Menu
					align="center"
					action={maybeToggleMenu}
					title={props.title}
					titleIcon={props.titleIcon}
					target={buttonRef.current}
					items={props.items}
					focusOnSelect={buttonRef.current}
				/>
			)}
			<TextButton ref={buttonRef} onClick={toggleMenu} tabIndex={0} onKeyPress={handleKeyPress}>
				{props.value}
				<Icon name="chevron-down" />
			</TextButton>
		</>
	);
}
