import { PropsWithChildren } from "react";
import React from "react";
import styled, { CSSProperties } from "styled-components";
import Icon from "../../Stream/Icon";

export interface IRadioGroupContext {
	name: string;
	selectedValue: string;
	loading: boolean;
	onChange: Function;
}

export const RadioGroupContext = React.createContext<IRadioGroupContext>({
	name: "",
	selectedValue: "",
	loading: false,
	onChange: () => {}
});

interface RadioProps {
	value: string;
	children: React.ReactNode;
}

const RadioDiv = styled.div`
	display: flex;
	margin-bottom: 5px;
	> div {
		margin-right: 5px;
		text-align: center;
		flex: 1 1 20px;
	}
	label {
		flex: 100 1;
	}
	input,
	label {
		cursor: pointer;
	}
	label:hover {
		color: var(--text-color-highlight);
	}
	.icon.spin {
		display: inline-block;
		margin: 0 5px 0 2px;
		vertical-align: 2px;
	}
	input[type="radio"] {
		-webkit-appearance: none;
		background: rgba(127, 127, 127, 0.4);

		// padding: 8px;
		width: 16px;
		height: 16px;
		display: inline-block;
		position: relative;
		border-radius: 10px;
		margin: 0 5px 0 0;
		cursor: pointer;
		&:checked {
			background: var(--text-color-info-muted);
		}
		&:checked:after {
			content: "";
			position: absolute;
			top: 6px;
			left: 6px;
			width: 4px;
			height: 4px;
			border-radius: 2px;
			background: white;
		}
	}
`;

export function Radio(props: PropsWithChildren<RadioProps>) {
	const { name, selectedValue, onChange, loading } = React.useContext(RadioGroupContext);

	const showSpinner = loading && props.value === selectedValue;
	return (
		<RadioDiv>
			<div>
				{showSpinner ? (
					<Icon className="spin" name="sync" />
				) : (
					<input
						type="radio"
						name={name}
						value={props.value}
						id={name + ":" + props.value}
						checked={props.value === selectedValue}
						onChange={e => onChange(props.value)}
					/>
				)}
			</div>
			<label htmlFor={name + ":" + props.value}>{props.children}</label>
		</RadioDiv>
	);
}

interface RadioGroupProps {
	name: string;
	selectedValue: string;
	loading: boolean;
	children: React.ReactNode;
	onChange: Function;
}

export function RadioGroup(props: PropsWithChildren<RadioGroupProps>) {
	const context = React.useContext(RadioGroupContext);
	context.name = props.name;
	context.selectedValue = props.selectedValue;
	context.onChange = props.onChange;
	context.loading = props.loading;
	return <div className="control-group radio">{props.children}</div>;
}
