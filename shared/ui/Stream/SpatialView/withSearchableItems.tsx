import React from "react";
import { CSReview, CodemarkType } from "@codestream/protocols/api";
import { CodemarkPlus } from "@codestream/protocols/agent";
import { CodeStreamState } from "@codestream/webview/store";
import { useSelector, useDispatch } from "react-redux";
import { orderBy } from "lodash-es";
import { createSelector } from "reselect";
import { mapFilter } from "@codestream/webview/utils";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { fetchReviews } from "@codestream/webview/store/reviews/actions";

type SearchableItems = (CSReview | CodemarkPlus)[];

type ProvidingProps = { items: SearchableItems };

const getSearchableCodemarks = createSelector(
	(state: CodeStreamState) => state.codemarks,
	codemarksState => {
		return mapFilter(Object.values(codemarksState), codemark => {
			if (
				!codemark.isChangeRequest &&
				(codemark.type === CodemarkType.Comment || codemark.type === CodemarkType.Issue)
			) {
				return codemark;
			}
			return;
		});
	}
);

export function withSearchableItems<ChildProps extends ProvidingProps>(
	Child: React.ElementType<ChildProps>
) {
	return function WithSearchableItems(props: ChildProps) {
		const dispatch = useDispatch();
		const codemarks = useSelector(getSearchableCodemarks);
		const reviewsState = useSelector((state: CodeStreamState) => state.reviews);

		useDidMount(() => {
			if (Object.keys(reviewsState).length === 0) dispatch(fetchReviews());
		});

		const items = React.useMemo(
			// sort by most recent first
			() => orderBy([...codemarks, ...Object.values(reviewsState)], "createdAt", "desc"),
			[codemarks, reviewsState]
		);

		return React.createElement(Child, { ...props, items });
	};
}
