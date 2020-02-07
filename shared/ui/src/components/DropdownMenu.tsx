import React from "react";
import styled from "styled-components";
import Menu from "../../Stream/Menu";
import Icon from "@codestream/webview/Stream/Icon";

const Root = styled.div`
	display: inline-block;
	white-space: nowrap;
	cursor: pointer;
	color: var(--text-color-highlight);
	.chevron-down {
		display: inline-block;
		transform: scale(0.7);
		margin-left: 2px;
		margin-right: 5px;
	}
`;

interface State {
	open: boolean;
	target?: any;
}

export interface Props {
	items?: any[];
	title?: string;
	children?: React.ReactNode;
}

export class DropdownMenu extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { open: false, target: undefined };
	}

	toggleMenu = (e: React.SyntheticEvent) => {
		this.setState({ open: !this.state.open, target: e && e.target });
	};

	noop = value => {
		if (!value) this.setState({ open: false });
	};

	render() {
		const { children, title, items = [] } = this.props;
		if (!items.length) {
			return children;
		}
		return (
			<Root>
				<span onClick={this.toggleMenu}>
					{children}
					<Icon name="chevron-down" className="chevron-down" />
				</span>
				{this.state.open && (
					<Menu
						title={title}
						align="center"
						valign="bottom"
						items={items}
						target={this.state.target}
						action={this.toggleMenu}
					/>
				)}
			</Root>
		);
	}
}
