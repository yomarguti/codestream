"use strict";
import { DocumentMarker } from "@codestream/protocols/agent";
import { CSMarker, CSMarkerIdentifier } from "@codestream/protocols/api";
import { Range } from "vscode";
import { Dates, memoize } from "../../system";
import { CodeStreamSession } from "../session";

export class DocMarker {
	private readonly _range: Range;

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _entity: DocumentMarker
	) {
		this._range = new Range(
			_entity.range.start.line,
			_entity.range.start.character,
			_entity.range.end.line,
			_entity.range.end.character
		);
	}

	get code(): string {
		return this._entity.code;
	}

	get codemarkId() {
		return this._entity.codemarkId;
	}

	get color(): string {
		return this._entity.codemark.color || "blue";
	}

	get creatorName() {
		return this._entity.creatorName;
	}

	@memoize
	get date() {
		return new Date(this.entity.createdAt);
	}

	@memoize
	get entity(): CSMarker {
		return this._entity;
	}

	@memoize
	get hoverRange() {
		return new Range(this._range.start.line, 0, this._range.start.line, 0);
	}

	get id() {
		return this._entity.id;
	}

	@memoize
	get identifier(): CSMarkerIdentifier {
		return { id: this.entity.id, file: this.entity.file, repoId: this.entity.repoId };
	}

	get postId() {
		return this._entity.postId || this._entity.codemark.postId;
	}

	get postStreamId() {
		return this._entity.postStreamId || this._entity.codemark.streamId;
	}

	get range() {
		return this._range;
	}

	get status(): string {
		return this._entity.codemark.status || "open";
	}

	get summary() {
		return this._entity.summary;
	}

	get summaryMarkdown() {
		return this._entity.summaryMarkdown;
	}

	get pinned() {
		return this._entity.codemark.pinned;
	}

	get type(): string {
		return this._entity.codemark.type || "comment";
	}

	private _dateFormatter?: Dates.IDateFormatter;

	formatDate(format?: string | null) {
		if (format == null) {
			format = "MMMM Do, YYYY h:mma";
		}

		if (this._dateFormatter === undefined) {
			this._dateFormatter = Dates.toFormatter(this.date);
		}
		return this._dateFormatter.format(format);
	}

	fromNow() {
		if (this._dateFormatter === undefined) {
			this._dateFormatter = Dates.toFormatter(this.date);
		}
		return this._dateFormatter.fromNow();
	}
}
