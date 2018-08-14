"use strict";

import "mocha";
import { CatchUpTest } from "./catchUpTest";
import { ConfirmFailureRecoveryTest } from "./confirmFailureRecoveryTest";
import { ConfirmFailureTest } from "./confirmFailureTest";
import { ExceedBatchLimitTest } from "./exceedBatchLimitTest";
import { GoOnlineTest } from "./goOnlineTest";
import { InvalidAuthKeyTest } from "./invalidAuthKeyTest";
import { InvalidChannelTest } from "./invalidChannelTest";
import { LongTickConfirmTest } from "./longTickConfirmTest";
import { LongTickOfflineTest } from "./longTickOfflineTest";
import { MalformedChannelTest } from "./malformedChannelTest";
import { MessageTest } from "./messageTest";
import { MultiMessageCatchUpTest } from "./multiMessageCatchUpTest";
import { NetErrorConfirmTest } from "./netErrorConfirmTest";
import { NetErrorOfflineTest } from "./netErrorOfflineTest";
import { OfflineTest } from "./offlineTest";
import { OnlineConfirmTest } from "./onlineConfirmTest";
import { PubnubTester, PubnubTesterConfig } from "./pubnubTester";
import { QueuedChannelsTest } from "./queuedChannelsTest";
import { ResetAfterTooLongTest } from "./resetAfterTooLongTest";
import { SecondSubscriptionTest } from "./secondSubscriptionTest";
import { StartOfflineTest } from "./startOfflineTest";
import { SubscriptionTest } from "./subscriptionTest";
import { SubscriptionTimeoutGrantFailureTest } from "./subscriptionTimeoutGrantFailureTest";
import { SubscriptionTimeoutGrantTest } from "./subscriptionTimeoutGrantTest";
import { SubscriptionTimeoutQueueTest } from "./subscriptionTimeoutQueueTest";
import { SubscriptionTimeoutRecoveryTest } from "./subscriptionTimeoutRecoveryTest";
import { SubscriptionTimeoutTest } from "./subscriptionTimeoutTest";

const TesterConfig: PubnubTesterConfig = {
	apiOrigin: process.env.CS_AGENT_API_ORIGIN || "https://127.0.0.1:12079"
};

const Tests: PubnubTester[] = [
	new SubscriptionTest(TesterConfig),
	new SecondSubscriptionTest(TesterConfig),
	new QueuedChannelsTest(TesterConfig),
	new OfflineTest(TesterConfig),
	new StartOfflineTest(TesterConfig),
	new GoOnlineTest(TesterConfig),
	new LongTickOfflineTest(TesterConfig),
	new LongTickConfirmTest(TesterConfig),
	new NetErrorOfflineTest(TesterConfig),
	new NetErrorConfirmTest(TesterConfig),
	new OnlineConfirmTest(TesterConfig),
	new ConfirmFailureTest(TesterConfig),
	new ConfirmFailureRecoveryTest(TesterConfig),
	new SubscriptionTimeoutTest(TesterConfig),
	new SubscriptionTimeoutGrantTest(TesterConfig),
	new SubscriptionTimeoutRecoveryTest(TesterConfig),
	new SubscriptionTimeoutQueueTest(TesterConfig),
	new SubscriptionTimeoutGrantFailureTest(TesterConfig),
	new InvalidChannelTest(TesterConfig),
	new MalformedChannelTest(TesterConfig),
	new MessageTest(TesterConfig),
	new CatchUpTest(TesterConfig),
	new MultiMessageCatchUpTest(TesterConfig),
	new ExceedBatchLimitTest(TesterConfig),
	new ResetAfterTooLongTest(TesterConfig),
	new InvalidAuthKeyTest(TesterConfig)
];

describe("Pubnub tests", function() {
	this.timeout(20000);
	Tests.forEach(async test => {
		describe(test.describe(), () => {
			before(test.before.bind(test));
			after(test.after.bind(test));
			it(`${test.testNum} - ${test.describe()}`, async () => {
				await test.run();
			}).timeout(test.getTestTimeout() + 1000);
		});
	});
});
