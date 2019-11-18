import { FormattedList, FormattedPlural } from "react-intl";
import React from "react";

// because typescript is wrongly complaining about expected props in v3.6.4
const FormattedPluralAlias = FormattedPlural as any;

type PropsOf<FunctionComponent> = FunctionComponent extends React.FunctionComponent<infer P>
	? P
	: never;

/*
	Given an array of renderable things, the result will be a grammatically formatted list of the first 3 elements
	and then the number of other elements.

	returns:
		a
		OR
		a and b
		OR
		a, b, and c
		OR
		a, b, c, and x others
*/
export function SmartFormattedList(props: Pick<PropsOf<typeof FormattedList>, "value">) {
	const _value = props.value;
	const otherCount = _value.length - 3;
	const value = _value.slice(0, 3);

	return (
		<>
			<FormattedList style={otherCount > 0 ? "narrow" : "long"} value={value} />
			{otherCount > 0 ? (
				<>
					{" "}
					and {otherCount} <FormattedPluralAlias value={otherCount} one="other" other="others" />
				</>
			) : (
				""
			)}
		</>
	);
}
