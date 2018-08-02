"use strict";

import { InvalidChannelTest } from "./invalidChannelTest";

export class MalformedChannelTest extends InvalidChannelTest {
	describe() {
		return "subscription to a channel with a malformed name should be rejected";
	}

	getInvalidChannelName() {
		return "xyz";
	}
}
