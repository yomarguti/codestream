import { useState, useCallback, PropsWithChildren } from "react";
import React from "react";
import { AnyObject } from "../utils";

interface TextInputProps extends Pick<React.HTMLAttributes<HTMLInputElement>, "onPaste"> {
	value: string;
	onChange(value: string): void;
	onValidityChanged?(name: string, valid: boolean): void;
	name?: string;
	type?: string;
	required?: boolean;
	validate?(value: string): boolean;
	placeholder?: string;
	nativeProps?: AnyObject;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function(
	props: PropsWithChildren<TextInputProps>,
	ref: React.Ref<HTMLInputElement>
) {
	const [isTouched, setIsTouched] = useState(false);

	const onChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			event.preventDefault();
			props.onChange(event.currentTarget.value);
		},
		[props.onChange]
	);

	const onBlur = useCallback(() => {
		if (!isTouched) setIsTouched(true);
		if (props.validate) {
			if (!props.onValidityChanged || !props.name)
				throw new Error(
					"<TextInput/> validations require `validate`, `onValidityChanged`, and `name` props"
				);
			props.onValidityChanged(props.name, props.validate(props.value));
		}
	}, [props.value, props.validate, props.name]);

	return (
		<input
			ref={ref}
			className="input-text"
			type={props.type}
			name={props.name}
			value={props.value}
			onChange={onChange}
			onBlur={onBlur}
			placeholder={props.placeholder}
			onPaste={props.onPaste}
			{...props.nativeProps}
		/>
	);
});

TextInput.defaultProps = { type: "text", nativeProps: {} };
