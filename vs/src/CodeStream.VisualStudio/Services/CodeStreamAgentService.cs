using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamAgentService
    {

    }

    public interface ICodeStreamAgentService
    {
        bool IsReady { get; }
        System.Threading.Tasks.Task SetRpcAsync(JsonRpc rpc);
        Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
        Task<PrepareCodeResponse> PrepareCodeAsync(string uri, Range range,
           CancellationToken? cancellationToken = null
        );
        Task<GetPostResponse> GetPostAsync(string streamId, string postId);
        Task<GetUserResponse> GetUserAsync(string userId);
        Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl);
        Task<JToken> LoginAsync(string email, string password, string serverUrl);
        Task<BootstrapState> GetBootstrapAsync(State state, Settings settings);
        Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
        Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
        Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(FileUri uri, CancellationToken? cancellationToken = null);
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

    public class LoginRequest
    {

        public string ServerUrl { get; set; }
        public string Email { get; set; }
        public string PasswordOrToken { get; set; }
        public string SignupToken { get; set; }
        public string Type { get; set; }
        public string Team { get; set; }
        public string TeamId { get; set; }
        public Extension Extension { get; set; }
        public Ide Ide { get; set; }
        public string TraceLevel { get; set; }
    }

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

    public class CodeStreamAgentService : ICodeStreamAgentService
    {
        static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();
        private readonly IAsyncServiceProvider _serviceProvider;
        public CodeStreamAgentService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public bool IsReady { get; private set; }
        private JsonRpc Rpc { get; set; }

        public async System.Threading.Tasks.Task SetRpcAsync(JsonRpc rpc)
        {
            await System.Threading.Tasks.Task.Yield();
            Rpc = rpc;

            IsReady = true;
        }

        public async Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            if (!IsReady)
            {
                return default(T);
            }

            cancellationToken = cancellationToken ?? CancellationToken.None;
            try
            {
                return await Rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "SendAsync Name={Name}", name);
                throw;
            }
        }

        public async Task<FetchCodemarksResponse> GetMarkersAsync(string streamId)
        {
            return await SendAsync<FetchCodemarksResponse>("codeStream/fetchCodemarks", new { streamId = streamId });
        }

        public async Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(FileUri uri,
            CancellationToken? cancellationToken = null)
        {
            return await SendAsync<DocumentMarkersResponse>("codeStream/textDocument/markers", new
            {
                textDocument = new { uri = uri.ToString() }
            }, cancellationToken);
        }

        public async Task<GetPostResponse> GetPostAsync(string streamId, string postId)
        {
            return await SendAsync<GetPostResponse>("codeStream/post", new
            {
                streamId,
                postId
            });
        }

        public async Task<GetUserResponse> GetUserAsync(string userId)
        {
            return await SendAsync<GetUserResponse>("codeStream/user", new
            {
               userId
            });
        }

        public async Task<PrepareCodeResponse> PrepareCodeAsync(string uri,
            Range range,
            CancellationToken? cancellationToken = null
         )
        {
            return await SendAsync<PrepareCodeResponse>("codeStream/post/prepareWithCode",
                new
                {
                    textDocument = new { uri = uri },
                    range = new
                    {
                        start = new { line = range.StartLine, character = range.StartCharacter },
                        end = new { line = range.EndLine, character = range.EndCharacter }
                    },
                    dirty = false
                }, cancellationToken);
        }

        public async Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login", new LoginRequest
            {
                SignupToken = signupToken,
                ServerUrl = serverUrl,
                Type = "otc",
                Extension = Application.Extension,
                Ide = Application.Ide,
                TraceLevel = "verbose"
            });
        }

        public async Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login", new LoginRequest
            {
                Email = email,
                PasswordOrToken = password,
                ServerUrl = serverUrl,
                Type = "credentials",
                Extension = Application.Extension,
                Ide = Application.Ide,
                TraceLevel = "verbose"
            });
        }

        public async Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request)
        {
            return await SendAsync<DocumentFromMarkerResponse>("codeStream/textDocument/fromMarker", new
            {
                file = request.File,
                repoId = request.RepoId,
                markerId = request.MarkerId,
                source = request.Source
            });
        }

        public async Task<BootstrapState> GetBootstrapAsync(State state, Settings settings)
        {
            var repos = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streams = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teams = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreads = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var users = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferences = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");

            var bootstrapState = new BootstrapState
            {
                Capabilities = state.Capabilities,
                CurrentUserId = state.UserId,
                CurrentTeamId = state.TeamId,
                Configs = new Config
                {
                    ServerUrl = settings.ServerUrl,
                    Email = state.Email,
                    ShowMarkers = settings.ShowMarkers,
                    ShowHeadshots = settings.ShowHeadshots,
                    OpenCommentOnSelect = settings.OpenCommentOnSelect,
                    Team = settings.Team
                },
                Env = state.Environment,
                Repos = repos.Value<JToken>("repos").ToObject<List<CsRepository>>(),
                Streams = streams.Value<JToken>("streams").ToObject<List<CsStream>>(),
                Teams = teams.Value<JToken>("teams").ToObject<List<Team>>(),
                Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CsUnreads>(),
                Users = users.Value<JToken>("users").ToObject<List<CsUser>>(),
                Preferences = usersPreferences.Value<JToken>("preferences").ToObject<CsMePreferences>(),
                Services = new Service
                {
                    //TODO
                    Vsls = false
                }
            };

            return bootstrapState;
        }
    }
}