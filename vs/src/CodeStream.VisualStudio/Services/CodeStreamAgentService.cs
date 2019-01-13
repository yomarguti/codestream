using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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

        Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl);
        Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl);
        Task<JToken> LoginAsync(string email, string password, string serverUrl);
        Task<JToken> LogoutAsync();
        Task<BootstrapStateBase> GetBootstrapAsync(Settings settings, State state = null, bool isAuthenticated = false);
        Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
        Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
        Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, CancellationToken? cancellationToken = null);
    }

    public class PrepareCodeResponse
    {
        public string Code { get; set; }
        public string GitError { get; set; }
        public Source Source { get; set; }
    }

    public class FetchCodemarksResponse
    {
        public List<CsMarker> Markers { get; set; }
        public List<CsFullCodemark> Codemarks { get; set; }
    }

    public class DocumentMarkersResponse
    {
        public List<CsFullMarker> Markers { get; set; }
        public List<MarkerNotLocated> MarkersNotLocated { get; set; }
    }

    public class FetchPostsRequest
    {
        public string StreamId { get; set; }
        public int? Limit { get; set; }
        public object After { get; set; }
        public object Before { get; set; }
        public bool? Inclusive { get; set; }
    }

    public abstract class LoginRequestBase<T>
    {
        public string ServerUrl { get; set; }
        public string Email { get; set; }
        public T PasswordOrToken { get; set; }
        public string SignupToken { get; set; }
        public string Team { get; set; }
        public string TeamId { get; set; }
        public Extension Extension { get; set; }
        public Ide Ide { get; set; }
        public string TraceLevel { get; set; }
        public bool IsDebugging { get; set; }
    }

    public class LoginAccessToken
    {
        public LoginAccessToken(string email, string url, string value)
        {
            Email = email;
            Url = url;
            Value = value;
        }

        public string Email { get; }
        public string Url { get; }
        public string Value { get; }
    }

    public class LoginRequest : LoginRequestBase<string> { }

    public class LoginViaAccessTokenRequest : LoginRequestBase<LoginAccessToken> { }

    public class LogoutRequest { }

    public class TextDocumentIdentifier
    {
        public string Uri { get; set; }
    }

    public class DocumentFromMarkerRequest
    {
        public string File { get; set; }
        public string RepoId { get; set; }
        public string MarkerId { get; set; }
        public string Source { get; set; }
    }

    public class DocumentFromMarkerResponse
    {
        public TextDocumentIdentifier TextDocument { get; set; }
        public CsRange Range { get; set; }
        public string Revision { get; set; }
    }

    public class GetPostResponse
    {
        public CsPost Post { get; set; }
    }

    public class GetUserResponse
    {
        public CsUser User { get; set; }
    }

    public class GetFileStreamResponse
    {
        public CsFileStream Stream { get; set; }
    }

    public enum StreamType
    {
        // ReSharper disable InconsistentNaming
        channel,
        direct,
        file
        // ReSharper restore InconsistentNaming
    }

    public class GetStreamRequest
    {
        public string StreamId { get; set; }
        public StreamType? Type { get; set; }
    }

    public class GetStreamResponse
    {
        public CsStream Stream { get; set; }
    }

    public class CreateCodemarkRequestMarker
    {
        public string Code { get; set; }
        public List<string> Remotes { get; set; }
        public string File { get; set; }
        public string CommitHash { get; set; }
        public List<object> Location { get; set; } //CsLocationarray
    }

    public class CreateCodemarkRequest
    {
        public CodemarkType Type { get; set; }
        public ProviderType? ProviderType { get; set; }
        public string Text { get; set; }
        public string StreamId { get; set; }
        public string PostId { get; set; }
        public string ParentPostId { get; set; }
        public string Color { get; set; }
        public string Status { get; set; }
        public string Title { get; set; }
        public List<string> Assignees { get; set; }
        public List<CreateCodemarkRequestMarker> Markers { get; set; }
        public List<string> Remotes { get; set; }
    }

    public class CreatePostRequest
    {
        public string StreamId { get; set; }
        public string Text { get; set; }
        public List<string> MentionedUserIds { get; set; }
        public string ParentPostId { get; set; }
        public CreateCodemarkRequest Codemark { get; set; }
    }

    public class CodeStreamAgentService : ICodeStreamAgentService, SCodeStreamAgentService
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();
        private readonly ISessionService _sessionService;
        private readonly ISettingsService _settingsService;

        public CodeStreamAgentService(ISessionService sessionService, ISettingsService settingsService)
        {
            _sessionService = sessionService;
            _settingsService = settingsService;
        }

        private JsonRpc _rpc;

        public Task SetRpcAsync(JsonRpc rpc)
        {
            _rpc = rpc;
            return Task.CompletedTask;
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
                    Services = new Service(),
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
                Teams = teams.Value<JToken>("teams").ToObject<List<Team>>(),
                Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CsUnreads>(),
                Users = users.Value<JToken>("users").ToObject<List<CsUser>>(),
                Preferences = usersPreferences.Value<JToken>("preferences").ToObject<CsMePreferences>(),
                Services = new Service
                {
                    // TODO not implemented
                    Vsls = false
                }
            };

            return bootstrapState;
        }
    }
}