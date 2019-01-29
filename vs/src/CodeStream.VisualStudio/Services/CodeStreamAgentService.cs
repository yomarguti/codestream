using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Task = System.Threading.Tasks.Task;

// ReSharper disable ClassNeverInstantiated.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamAgentService { }

    public interface ICodeStreamAgentService
    {
        Task SetRpcAsync(JsonRpc rpc);
        Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
        Task<PrepareCodeResponse> PrepareCodeAsync(Uri uri, Range range, bool isDirty,
           CancellationToken? cancellationToken = null
        );

        Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text);
        Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri);
        Task<GetPostResponse> GetPostAsync(string streamId, string postId);
        Task<GetUserResponse> GetUserAsync(string userId);
        Task<JToken> ChangeStreamThreadAsync(string streamId, string threadId);
        Task<GetStreamResponse> GetStreamAsync(string streamId);
        Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds);
        Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl);
        Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl);
        Task<JToken> LoginAsync(string email, string password, string serverUrl);
        Task<JToken> LogoutAsync();
        Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false);
        Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
        Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
        Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, CancellationToken? cancellationToken = null);
        Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request);
    }

    [Injected]
    public class CodeStreamAgentService : ICodeStreamAgentService, SCodeStreamAgentService, IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();
        private readonly ISessionService _sessionService;
        private readonly ISettingsService _settingsService;
        private readonly IEventAggregator _eventAggregator;

        private JsonRpc _rpc;
        bool _disposed;

        public CodeStreamAgentService(ISessionService sessionService, ISettingsService settingsService, IEventAggregator eventAggregator)
        {
            _sessionService = sessionService;
            _settingsService = settingsService;
            _eventAggregator = eventAggregator;
        }

        public Task SetRpcAsync(JsonRpc rpc)
        {
            _rpc = rpc;
            _rpc.Disconnected += Rpc_Disconnected;

            return Task.CompletedTask;
        }

        private void Rpc_Disconnected(object sender, JsonRpcDisconnectedEventArgs e)
        {
            Log.Verbose(e.Exception, $"RPC Disconnected: {e.LastMessage} {e.Description}");
            _sessionService.SetAgentDisconnected();
            _eventAggregator?.Publish(new LanguageServerDisconnectedEvent(e?.LastMessage, e?.Description, e?.Reason.ToString(), e?.Exception));
        }

        private Task<T> SendCoreAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            cancellationToken = cancellationToken ?? CancellationToken.None;
            try
            {
                return _rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "SendName={Name}", name);
                throw;
            }
        }

        public Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            if (!_sessionService.IsReady) return Task.FromResult(default(T));

            return SendCoreAsync<T>(name, arguments, cancellationToken);
        }

        public Task<FetchCodemarksResponse> GetMarkersAsync(string streamId)
        {
            return SendAsync<FetchCodemarksResponse>("codeStream/fetchCodemarks", new FetchCodemarksRequest { StreamId = streamId });
        }

        public Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri,
            CancellationToken? cancellationToken = null)
        {
            return SendAsync<DocumentMarkersResponse>("codeStream/textDocument/markers", new DocumentMarkersRequest
            {
                TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() }
            }, cancellationToken);
        }

        public Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri)
        {
            return SendAsync<GetFileStreamResponse>("codeStream/streams/fileStream", new GetFileStreamRequest
            {
                TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() }
            });
        }

        public Task<JToken> ChangeStreamThreadAsync(string streamId, string threadId)
        {
            return SendAsync<JToken>("codestream:interaction:stream-thread-selected", new StreamThreadSelectedRequest
            {
                StreamId = streamId,
                ThreadId = threadId
            });
        }

        public Task<GetPostResponse> GetPostAsync(string streamId, string postId)
        {
            return SendAsync<GetPostResponse>("codeStream/post", new GetPostRequest
            {
                StreamId = streamId,
                PostId = postId
            });
        }

        public Task<GetStreamResponse> GetStreamAsync(string streamId)
        {
            return SendAsync<GetStreamResponse>("codeStream/stream", new GetStreamRequest
            {
                StreamId = streamId
            });
        }

        public Task<GetUserResponse> GetUserAsync(string userId)
        {
            return SendAsync<GetUserResponse>("codeStream/user", new GetUserRequest
            {
                UserId = userId
            });
        }

        public Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text)
        {
            return SendAsync<CreatePostResponse>("codeStream/posts/create", new CreatePostRequest
            {
                StreamId = streamId,
                ParentPostId = threadId,
                Text = text
            });
        }

        public Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds)
        {
            return SendAsync<CsDirectStream>("codeStream/streams/createDirect", new CreateDirectStreamRequest
            {
                Type = StreamType.direct.ToString(),
                MemberIds = memberIds
            });
        }

        public Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request)
        {
            return SendAsync<FetchStreamsResponse>("codeStream/streams", new FetchStreamsRequest2
            {
                Types = request.Types.Select(_ => _.ToString()).ToList(),
                MemberIds = request.MemberIds
            });
        }

        public Task<PrepareCodeResponse> PrepareCodeAsync(Uri uri, Range range, bool isDirty, CancellationToken? cancellationToken = null)
        {
            return SendAsync<PrepareCodeResponse>("codeStream/post/prepareWithCode",
                new PrepareCodeRequest
                {
                    TextDocument = new TextDocumentIdentifier() { Uri = uri.ToString() },
                    Range = new CsRange
                    {
                        Start = new CsRangePoint { Line = range.StartLine, Character = range.StartCharacter },
                        End = new CsRangePoint { Line = range.EndLine, Character = range.EndCharacter }
                    },
                    Dirty = isDirty
                }, cancellationToken);
        }

        public Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl)
        {
            return SendCoreAsync<JToken>("codeStream/login", new LoginViaAccessTokenRequest
            {
                Email = email,
                PasswordOrToken = new LoginAccessToken(email, serverUrl, token),
                ServerUrl = serverUrl,
                Extension = _settingsService.GetExtensionInfo(),
                Ide = _settingsService.GetIdeInfo(),
#if DEBUG
                TraceLevel = TraceLevel.Verbose.ToJsonValue(),
                IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
            });
        }

        public Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl)
        {
            return SendCoreAsync<JToken>("codeStream/login", new LoginRequest
            {
                SignupToken = signupToken,
                ServerUrl = serverUrl,
                Extension = _settingsService.GetExtensionInfo(),
                Ide = _settingsService.GetIdeInfo(),
#if DEBUG
                TraceLevel = TraceLevel.Verbose.ToJsonValue(),
                IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
            });
        }

        public Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            var extensionInfo = _settingsService.GetExtensionInfo();
            var ideInfo = _settingsService.GetIdeInfo();

            return SendCoreAsync<JToken>("codeStream/login", new LoginRequest
            {
                Email = email,
                PasswordOrToken = password,
                ServerUrl = serverUrl,
                Extension = extensionInfo,
                Ide = ideInfo,
#if DEBUG
                TraceLevel = TraceLevel.Verbose.ToJsonValue(),
                IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
            });
        }

        public Task<JToken> LogoutAsync()
        {
            return SendAsync<JToken>("codeStream/logout", new LogoutRequest());
        }

        public Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request)
        {
            return SendAsync<DocumentFromMarkerResponse>("codeStream/textDocument/fromMarker", request);
        }

        public async Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false)
        {
            JObject capabilitiesHolder = JObject.Parse("{}");

            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
            var vslsEnabled = ideService?.QueryExtension(ExtensionKind.LiveShare) == true;

            JObject ideCapabilities = JObject.Parse((new
            {
                channelMute = false,
                codemarkApply = false,
                codemarkCompare = false,
                editorTrackVisibleRange = false,
                services = new
                {
                    vsls = vslsEnabled
                }
            }).ToJson());

            if (state?["capabilities"] != null)
            {
                capabilitiesHolder.Merge(JObject.Parse(state["capabilities"].ToString()), new JsonMergeSettings
                {
                    MergeArrayHandling = MergeArrayHandling.Union
                });

                capabilitiesHolder.Merge(ideCapabilities, new JsonMergeSettings
                {
                    MergeArrayHandling = MergeArrayHandling.Union
                });
            }
            else
            {
                capabilitiesHolder.Merge(ideCapabilities, new JsonMergeSettings
                {
                    MergeArrayHandling = MergeArrayHandling.Union
                });
            }

            if (!isAuthenticated)
            {
                return JToken.FromObject(new
                {
                    capabilities = capabilitiesHolder,
                    configs = new
                    {
                        serverUrl = _settingsService.ServerUrl,
                        email = _settingsService.Email,
                        openCommentOnSelect = _settingsService.OpenCommentOnSelect,
                        showHeadshots = _settingsService.ShowHeadshots,
                        showMarkers = _settingsService.ShowMarkers,
                        team = _settingsService.Team
                    },
                    env = _settingsService.GetEnvironmentName(),
                    version = _settingsService.GetEnvironmentVersionFormated(Application.ExtensionVersionShortString,
                        Application.BuildNumber)

                });
            }

            if (state == null) throw new ArgumentNullException(nameof(state));

            var reposTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streamsTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teamsTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreadsTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var usersTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferencesTask = _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");
            await Task.WhenAll(reposTask, streamsTask, teamsTask, usersUnreadsTask, usersTask, usersPreferencesTask).ConfigureAwait(false);

            var repos = await reposTask.ConfigureAwait(false);
            var streams = await streamsTask.ConfigureAwait(false);
            var teams = await teamsTask.ConfigureAwait(false);
            var usersUnreads = await usersUnreadsTask.ConfigureAwait(false);
            var users = await usersTask.ConfigureAwait(false);
            var usersPreferences = await usersPreferencesTask.ConfigureAwait(false);

            var bootstrapState = new
            {
                capabilities = capabilitiesHolder,
                currentUserId = state["userId"].ToString(),
                currentTeamId = state["teamId"].ToString(),
                configs = new
                {
#if DEBUG
                    debug = true,
#endif
                    serverUrl = settings.ServerUrl,
                    email = state["email"].ToString(),
                    showMarkers = settings.ShowMarkers,
                    showHeadshots = settings.ShowHeadshots,
                    openCommentOnSelect = settings.OpenCommentOnSelect,
                    team = settings.Team
                },
                env = settings.Env,
                version = settings.Version,
                repos = repos.Value<JToken>("repos"),
                streams = streams.Value<JToken>("streams"),
                teams = teams.Value<JToken>("teams"),
                unreads = usersUnreads.Value<JToken>("unreads"),
                users = users.Value<JToken>("users"),
                preferences = usersPreferences.Value<JToken>("preferences"),
            };

            return JToken.FromObject(bootstrapState);
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
                return;

            if (disposing)
            {
                _rpc.Disconnected -= Rpc_Disconnected;
            }

            _disposed = true;
        }
    }
}