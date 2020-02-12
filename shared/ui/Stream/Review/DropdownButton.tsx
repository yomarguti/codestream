import React from "react";
import { Button, getButtonProps, ButtonProps } from "../../src/components/Button";
import styled from "styled-components";
import Icon from "../Icon";
import Menu from "../Menu";
import { mapFilter } from "@codestream/webview/utils";

// This implementation isn't quite ideal.
// [The <Menu/> should appear below the caret button as if they are connected -this part is done now -Pez]
// The api for consumers could probably be better, but it's only used in the review component for now

export interface DropdownButtonProps extends ButtonProps {
	items: { label: any; action: () => void }[];
}

export function DropdownButton(props: DropdownButtonProps) {
	const buttonRef = React.useRef<HTMLElement>(null);
	const [menuIsOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);
	const [selectedItem, setSelectedItem] = React.useState(props.items[0]);

	// TODO: this is not the best way to check for uniqueness
	const items = mapFilter(props.items, i =>
		i.label === selectedItem.label
			? null
			: { key: i, label: i.label, action: () => setSelectedItem(i) }
	);

	const maybeToggleMenu = action => {
		if (action !== "noop") toggleMenu(action);
	};

	return (
		<Root>
			<StyledButton {...getButtonProps(props)} onClick={selectedItem.action}>
				{selectedItem.label}
			</StyledButton>
			<StyledButton ref={buttonRef} onClick={toggleMenu}>
				<Icon name="chevron-down" />
			</StyledButton>
			{menuIsOpen && buttonRef.current && (
				<Menu
					align="dropdownRight"
					action={maybeToggleMenu}
					target={buttonRef.current}
					items={items}
					focusOnSelect={buttonRef.current}
				/>
			)}
		</Root>
	);
}

const Root = styled.div`
	display: inline;
	button + button {
		border-left: 1px solid transparent !important;
	}
	// two dropdowns in a row
	& + & {
		padding-left: 10px;
	}
`;

const StyledButton = styled(Button)`
	border: 1px solid ${props => props.theme.colors.baseBorder} !important;
	background: transparent !important;
	color: var(--text-color) !important;
	&:hover {
		color: var(--button-foreground-color) !important;
		background: var(--button-background-color) !important;
		border: 1px solid var(--button-background-color) !important;
	}
`;
