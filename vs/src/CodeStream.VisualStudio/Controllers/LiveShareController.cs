using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using Task = System.Threading.Tasks.Task;

namespace CodeStream.VisualStudio.Controllers
{
    public class LiveShareController
    {
        private static readonly ILogger Log = LogManager.ForContext<LiveShareController>();

        private readonly ISessionService _sessionService;
        private readonly ICodeStreamAgentService _codeStreamAgent;
        private readonly IEventAggregator _eventAggregator;
        private readonly IBrowserService _browserService;
        private readonly IIdeService _ideService;

        public LiveShareController(
            ISessionService sessionService,
            ICodeStreamAgentService codeStreamAgent,
            IEventAggregator eventAggregator,
            IBrowserService browserService,
            IIdeService ideService)
        {
            _sessionService = sessionService;
            _codeStreamAgent = codeStreamAgent;
            _eventAggregator = eventAggregator;
            _browserService = browserService;
            _ideService = ideService;
        }

        private async Task CreatePost(string streamId, string threadId, string url)
        {
            try
            {
                var streamResponse = await _codeStreamAgent.GetStreamAsync(streamId);
                if (streamResponse != null)
                {
                    var streamThread = new StreamThread(threadId, streamResponse.Stream);
                    await _codeStreamAgent.CreatePostAsync(streamThread.Stream.Id,
                        streamThread.Id, $"Join my Live Share session: {url}");

                    _sessionService.LiveShareUrl = url;
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not post Live Share url");
            }
        }

        public async Task StartAsync(string streamId, string threadId)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            var existingUrl = _sessionService.LiveShareUrl;
            if (!existingUrl.IsNullOrWhiteSpace())
            {
                await CreatePost(streamId, threadId, existingUrl);
            }
            else
            {
                if (!_ideService.TryStartLiveShare())
                {
                    await Task.CompletedTask;
                }
                else
                {
                    IDisposable liveShareReadyEvent = null;
                    liveShareReadyEvent = _eventAggregator.GetEvent<LiveShareStartedEvent>().Subscribe((_) =>
                    {
                        try
                        {
                            liveShareReadyEvent?.Dispose();

                            _ideService.GetClipboardTextValue(10000, async (string url) =>
                            {
                                await CreatePost(streamId, threadId, url);
                            }, RegularExpressions.LiveShareUrl);
                        }
                        catch (Exception ex)
                        {
                            Log.Error(ex, "Could not start Live Share");
                        }
                    });
                }
            }

            await Task.CompletedTask;
        }

        public async Task InviteAsync(object userIdObj)
        {
            try
            {
                var userIds = new List<string>();
                var userId = userIdObj as string;
                if (userId != null)
                {
                    userIds.Add(userId);
                }
                else
                {
                    userIds = userIdObj as List<string>;
                }

                if (userId != null)
                {
                    var memberIds = new List<string> { _sessionService.State.UserId };
                    foreach (var id in userIds)
                    {
                        var userResponse = await _codeStreamAgent.GetUserAsync(id);
                        memberIds.Add(userResponse.User.Id);
                    }

                    CsStream stream = null;
                    var fetchStreamsResponse = await _codeStreamAgent.FetchStreamsAsync(new FetchStreamsRequest
                    {
                        Types = new List<StreamType> { StreamType.direct },
                        MemberIds = memberIds
                    });

                    if (fetchStreamsResponse != null)
                    {
                        stream = fetchStreamsResponse.Streams.FirstOrDefault();
                    }

                    if (stream == null)
                    {
                        stream = await _codeStreamAgent.CreateDirectStreamAsync(memberIds);
                    }

                    if (_sessionService.LiveShareUrl.IsNullOrWhiteSpace())
                    {
                        // user clicked invite before starting a Live Share -- create one now!
                        await StartAsync(stream.Id, null);
                    }
                    else
                    {
                        var postResponse = await _codeStreamAgent.CreatePostAsync(stream.Id, null,
                            $"Join my Live Share session: {_sessionService.LiveShareUrl}");
                        if (postResponse != null)
                        {
                            // view thread
                            _browserService.PostMessage(new
                            {
                                type = "codestream:interaction:stream-thread-selected",
                                body = new
                                {
                                    streamId = stream.Id,
                                    threadId = (string)null
                                }
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error inviting to Live Share");
            }
        }

        public Task JoinAsync(string url)
        {
            _ideService.Navigate(url);
            return Task.CompletedTask;
        }
    }
}
