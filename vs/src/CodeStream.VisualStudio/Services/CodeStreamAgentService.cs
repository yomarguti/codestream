using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
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
using CodeStream.VisualStudio.Events;
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
        Task<PrepareCodeResponse> PrepareCodeAsync(string uri, Range range,
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
        Task<BootstrapStateBase> GetBootstrapAsync(Settings settings, State state = null, bool isAuthenticated = false);
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
            // TODO make a model
            // ReSharper disable once RedundantAnonymousTypePropertyName
            return SendAsync<FetchCodemarksResponse>("codeStream/fetchCodemarks", new { streamId = streamId });
        }

        public Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri,
            CancellationToken? cancellationToken = null)
        {
            return SendAsync<DocumentMarkersResponse>("codeStream/textDocument/markers", new
            {
                // TODO make a model
                textDocument = new { uri = uri.ToString() }
            }, cancellationToken);
        }

        public Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri)
        {
            return SendAsync<GetFileStreamResponse>("codeStream/streams/fileStream", new
            {
                // TODO make a model
                textDocument = new { uri = uri.ToString() }
            });
        }

        public Task<JToken> ChangeStreamThreadAsync(string streamId, string threadId)
        {
            return SendAsync<JToken>("codestream:interaction:stream-thread-selected", new
            {
                // TODO make a model
                // ReSharper disable RedundantAnonymousTypePropertyName
                streamId = streamId,
                threadId = threadId
                // ReSharper restore RedundantAnonymousTypePropertyName
            });
        }

        public Task<GetPostResponse> GetPostAsync(string streamId, string postId)
        {
            return SendAsync<GetPostResponse>("codeStream/post", new
            {
                // TODO make a model
                streamId,
                postId
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
            return SendAsync<GetUserResponse>("codeStream/user", new
            {
                // TODO make a model
                // ReSharper disable RedundantAnonymousTypePropertyName
                userId = userId
                // ReSharper restore RedundantAnonymousTypePropertyName
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
            return SendAsync<CsDirectStream>("codeStream/streams/createDirect", new
            {
                type = StreamType.direct.ToString(),
                memberIds = memberIds
            });
        }

        public Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request)
        {
            return SendAsync<FetchStreamsResponse>("codeStream/streams", new
            {
                types = request.Types.Select(_ => _.ToString()).ToList(),
                memberIds = request.MemberIds
            });
        }

        public Task<PrepareCodeResponse> PrepareCodeAsync(string uri, Range range, CancellationToken? cancellationToken = null)
        {
            return SendAsync<PrepareCodeResponse>("codeStream/post/prepareWithCode",
                new
                {
                    // TODO make a model
                    // ReSharper disable once RedundantAnonymousTypePropertyName
                    textDocument = new { uri = uri },
                    range = new
                    {
                        start = new { line = range.StartLine, character = range.StartCharacter },
                        end = new { line = range.EndLine, character = range.EndCharacter }
                    },
                    dirty = false
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
            return SendAsync<DocumentFromMarkerResponse>("codeStream/textDocument/fromMarker", new
            {
                file = request.File,
                repoId = request.RepoId,
                markerId = request.MarkerId,
                source = request.Source
            });
        }

        public async Task<BootstrapStateBase> GetBootstrapAsync(Settings settings, State state = null, bool isAuthenticated = false)
        {
            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
            var vslsEnabled = ideService?.QueryExtension(ExtensionKind.LiveShare) == true;

            if (!isAuthenticated)
            {
                return new BootstrapStateLite
                {
                    Configs = new Config
                    {
                        ServerUrl = _settingsService.ServerUrl,
                        Email = _settingsService.Email,
                        OpenCommentOnSelect = _settingsService.OpenCommentOnSelect,
                        ShowHeadshots = _settingsService.ShowHeadshots,
                        ShowMarkers = _settingsService.ShowMarkers,
                        Team = _settingsService.Team,

                    },
                    Services = new Service()
                    {
                        Vsls = vslsEnabled
                    },
                    Env = _settingsService.GetEnvironmentName(),
                    Version = _settingsService.GetEnvironmentVersionFormated(Application.ExtensionVersionShortString,
                        Application.BuildNumber)

                };
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

            var bootstrapState = new BootstrapState
            {
                Capabilities = state.Capabilities,
                CurrentUserId = state.UserId,
                CurrentTeamId = state.TeamId,
                Configs = new Config
                {
#if DEBUG
                    Debug = true,
#endif
                    ServerUrl = settings.ServerUrl,
                    Email = state.Email,
                    ShowMarkers = settings.ShowMarkers,
                    ShowHeadshots = settings.ShowHeadshots,
                    OpenCommentOnSelect = settings.OpenCommentOnSelect,
                    Team = settings.Team,
                    // TODO not implemented
                    //MuteAll = ...
                },
                Env = settings.Env,
                Version = settings.Version,
                Repos = repos.Value<JToken>("repos").ToObject<List<CsRepository>>(),
                Streams = streams.Value<JToken>("streams").ToObject<List<CsStream>>(),
                Teams = teams.Value<JToken>("teams").ToObject<List<CsTeam>>(),
                Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CsUnreads>(),
                Users = users.Value<JToken>("users").ToObject<List<CsUser>>(),
                Preferences = usersPreferences.Value<JToken>("preferences").ToObject<CsMePreferences>(),
                Services = new Service
                {
                    // TODO not implemented
                    Vsls = vslsEnabled
                }
            };

            return bootstrapState;
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