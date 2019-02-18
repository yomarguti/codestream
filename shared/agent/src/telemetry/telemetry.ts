"use strict";

import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import { CodeStreamEnvironment } from "../shared/agent.protocol";

// FIXME: sorry, typescript purists: i simply gave up trying to get the type definitions for this module to work
const Analytics = require("analytics-node");

export class TelemetryService {
	private _segmentInstance: any;
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

		const segmentToken =
			session.environment === CodeStreamEnvironment.Production
				? "34JaWg6wRO8Pq77fhs2VfVleHPuKG1bX"
				: "2lVxem4MsNFt28vNqEJr6PuR7HgE1P5T";
		const settings =
			session.environment === CodeStreamEnvironment.Production
				? {}
				: { flushAt: 1 };

		try {
			Logger.debug("COLIN USING " + segmentToken, settings);
			this._segmentInstance = new Analytics(segmentToken, settings);
		} catch (ex) {
			Logger.error(ex);
		}

		const props = { ...opts, Endpoint: session.versionInfo.ide.name };

		this._superProps = props;
		this._hasOptedOut = hasOptedOut;
	}

	identify(id: string, props?: { [key: string]: any }) {
		this._distinctId = id;
		if (this._hasOptedOut || this._segmentInstance == null) {
			return;
		}

		try {
			this._segmentInstance.identify({
				userId: this._distinctId,
				traits: props
			});
		} catch (ex) {
			Logger.error(ex);
		}
	}

	alias(id?: string) {
		if (this._hasOptedOut || this._distinctId == null || this._segmentInstance == null) {
			return;
		}

		try {
			this._segmentInstance.alias({
				previousId: this._distinctId,
				userId: id
			});
		} catch (ex) {
			Logger.error(ex);
		}
	}

	setConsent(hasConsented: boolean) {
		this._hasOptedOut = !hasConsented;
	}

	setSuperProps(props: { [key: string]: string | number | boolean }) {
		this._superProps = props;
	}

	track(event: string, data?: { [key: string]: string | number | boolean }) {
		Logger.debug(`Tracking event :: ${event}`);

		if (this._hasOptedOut || this._segmentInstance == null) {
			return;
		}
		const payload: { [key: string]: any } = { ...data, ...this._superProps };

		if (this._distinctId != null) {
			payload["distinct_id"] = this._distinctId;
		}

		try {
			Logger.debug(`COLIN Tracking ${event} for ${this._distinctId}`, payload);
			this._segmentInstance.track({
				userId: this._distinctId,
				event,
				properties: payload
			});
		} catch (ex) {
			Logger.debug("TRACKING ERROR!!!", ex);
			Logger.error(ex);
		}
	}
}
