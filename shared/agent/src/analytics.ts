"use strict";
import * as mixpanel from "mixpanel";
import { Logger } from "./logger";
import { CodeStreamSession } from "./session";
import { CodeStreamEnvironment } from "./shared/agent.protocol";

/**
 *
 * Would like for this to eventually be abstracted to swap out analytics services
 */
export class AnalyticsService {
	private _mpInstance: any;
	private _superProps: object;
	private _distinctId?: string;
	private _hasOptedOut: boolean;

	/**
	 * @param {boolean} hasOptedOut - Has the user opted out of tracking?
	 * @param {{ [key: string]: string | number }} [opts] - Additional options
	 */
	constructor(
		session: CodeStreamSession,
		hasOptedOut: boolean,
		opts?: { [key: string]: string | number | boolean }
	) {
		Logger.debug("AnalyticsService created");

		this._superProps = {};
		this._hasOptedOut = false;

		const mixpanelToken =
			session.environment === CodeStreamEnvironment.Production
				? "2c92bfd963bfbaf680be2f1d10e48003"
				: "4308967c7435e61d9697ce240bc68d02";

		try {
			this._mpInstance = mixpanel.init(mixpanelToken);
		} catch (ex) {
			Logger.error(ex);
		}

		const props = { ...opts, Endpoint: "agent" };

		this._superProps = props;
		this._hasOptedOut = hasOptedOut;

		// Even if opted in, let's opt out if we are debugging
		if (Logger.isDebugging) {
			this._hasOptedOut = true;
		}
	}

	setDistinctId(id: string) {
		this._distinctId = id;
	}

	setConsent(hasConsented: boolean) {
		this._hasOptedOut = !hasConsented;
	}

	setSuperProps(props: { [key: string]: string | number | boolean }) {
		this._superProps = props;
	}

	alias(id?: string) {
		if (this._hasOptedOut || this._distinctId == null || this._mpInstance == null) {
			return;
		}

		try {
			this._mpInstance.alias(this._distinctId, id);
		} catch (ex) {
			Logger.error(ex);
		}
	}

	track(event: string, data?: { [key: string]: string | number | boolean }) {
		Logger.debug(`Tracking event :: ${event}`);

		if (this._hasOptedOut || this._mpInstance == null) {
			return;
		}
		const payload: { [key: string]: any } = { ...data, ...this._superProps };

		if (this._distinctId != null) {
			payload["distinct_id"] = this._distinctId;
		}

		try {
			this._mpInstance.track(event, payload);
		} catch (ex) {
			Logger.error(ex);
		}
	}
}
