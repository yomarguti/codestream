"use strict";

import { CSCodemark } from "../shared/api.protocol.models";
import { EntityManagerBase, Id } from "./entityManager";

export class CodemarksManager extends EntityManagerBase<CSCodemark> {
	protected async fetchById(id: Id): Promise<CSCodemark> {
		const response = await this.session.api.getCodemark({ codemarkId: id });
		return response.codemark;
	}
}
