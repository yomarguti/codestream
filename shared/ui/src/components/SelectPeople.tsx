import React from "react";
import styled from "styled-components";
import Menu from "../../Stream/Menu";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { HeadshotName } from "@codestream/webview/src/components/HeadshotName";
import { CSUser, CSMe } from "@codestream/protocols/api";
import { CodeStreamState } from "@codestream/webview/store";
import { getTeamMembers } from "@codestream/webview/store/users/reducer";
import { connect } from "react-redux";
import Icon from "@codestream/webview/Stream/Icon";

export interface HeadshotMenuProps {
	size?: number;
	className?: string;
}

interface ClickProps {
	hasOnClick?: boolean;
}

const Root = styled.div<ClickProps>`
	display: inline-block;
	padding: 0 10px 5px 0;
	white-space: nowrap;
	cursor: ${props => (props.onClick ? "pointer" : "auto")};
	&:hover {
		color: ${props => props.theme.colors.textHighlight};
	}
`;

const Title = styled.span`
	display: flex;
	flex-direction: row;
	& > :nth-child(2) {
		padding: 0 0 0 10px;
	}
`;

interface State {
	open: boolean;
	target?: any;
}

export interface Props extends ConnectedProps {
	title?: string;
	value: CSUser[];
	onChange: Function;
	children?: React.ReactNode;
	multiSelect?: boolean;
	labelExtras?: { [id: string]: string };
}

interface ConnectedProps {
	teamMembers: CSUser[];
}

class SelectPeople extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { open: false, target: undefined };
	}

	openMenu = (e: React.SyntheticEvent) => {
		this.setState({ open: !this.state.open, target: e && e.target });
	};

	noop = value => {
		if (!value) this.setState({ open: false });
	};

	render() {
		const {
			value,
			title,
			children,
			teamMembers,
			onChange,
			multiSelect,
			labelExtras = {}
		} = this.props;
		const items = teamMembers.map(person => {
			const selected = value.find(p => p.id === person.id) ? true : false;
			const label = person.fullName ? `${person.fullName} (@${person.username})` : person.username;
			return {
				label: label + (labelExtras[person.id] || ""),
				searchLabel: person.username,
				checked: selected,
				value: person.username,
				action: () => onChange(person)
			};
		}) as any;
		if (items.length >= 5) {
			items.unshift({ label: "-" });
			items.unshift({ type: "search", placeholder: "Search...", action: "search" });
		}
		const action = multiSelect ? this.noop : this.openMenu;
		return (
			<>
				<span onClick={this.openMenu}>{children}</span>
				{this.state.open && (
					<Menu
						title={title}
						align="center"
						valign="bottom"
						items={items}
						target={this.state.target}
						action={this.openMenu}
						dontCloseOnSelect={true}
					/>
				)}
			</>
		);
	}
}

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	return { teamMembers: getTeamMembers(state) };
};

const ConnectedSelectPeople = connect(mapStateToProps, {})(SelectPeople);

export { ConnectedSelectPeople as SelectPeople };
