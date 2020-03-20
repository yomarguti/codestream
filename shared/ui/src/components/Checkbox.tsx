import { PropsWithChildren } from "react";
import React from "react";
import styled from "styled-components";
import Icon from "../../Stream/Icon";

interface Props {
	name: string;
	className?: string;
	checked?: boolean;
	loading?: boolean;
	noMargin?: boolean;
	onChange: (value: boolean) => void;
}

interface foo {
	bar: boolean;
}

const Root = styled.div<{ noMargin?: boolean }>`
	display: flex;
	margin-bottom: ${props => (props.noMargin ? "0" : "5px")};
	align-items: center;
	> div {
		text-align: center;
		flex: 1 1 20px;
	}
	label {
		display: inline-block;
		padding-top: 1px !important;
		padding-bottom: 0 !important;
		flex: 100 1;
	}
	input,
	label {
		cursor: pointer;
		margin-top: 0 !important; // this is an override of styles imposed by .standard-form
		margin-bottom: 0 !important; // this is an override of styles imposed by .standard-form
	}
	label:hover {
		color: var(--text-color-highlight);
	}
`;

export function Checkbox(props: PropsWithChildren<Props>) {
	const { name, checked, onChange, loading, className, noMargin } = props;

	return (
		<Root className={className} noMargin={noMargin}>
			<div>
				{loading ? (
					<Icon className="spin" name="sync" />
				) : (
					<input
						id={`checkbox-${name}`}
						type="checkbox"
						name={name}
						checked={checked}
						onChange={e => onChange(!checked)}
					/>
				)}
			</div>
			<label htmlFor={`checkbox-${name}`}>{props.children}</label>
		</Root>
	);
}
