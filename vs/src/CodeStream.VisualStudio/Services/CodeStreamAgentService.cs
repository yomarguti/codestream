using CodeStream.VisualStudio.Models;
using Newtonsoft.Json.Linq;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public class CodestreamAgentApi
    {
        private static readonly Lazy<CodestreamAgentApi> lazy =
            new Lazy<CodestreamAgentApi>(() => new CodestreamAgentApi());

        public static CodestreamAgentApi Instance { get { return lazy.Value; } }

        private CodestreamAgentApi()
        {
        }

        internal JsonRpc Rpc { get; set; }
        public void SetRpc(JsonRpc rpc)
        {
            Rpc = rpc;
        }

        public async Task<object> GetPostsAsync(string streamId, int limit = 50, object before = null, object after = null, bool? inclusive = null)
        {

            try
            {
                return await this.Rpc.InvokeWithParameterObjectAsync<object>("codeStream/posts",
                     new
                     {
                         streamId
                        //,
                        //limit,
                        //before,
                        //after,
                        //inclusive
                    });
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        public async Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            return await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/cli/login", new
            {
                email = email,
                passwordOrToken = password,
                serverUrl = serverUrl,
                signupToken = (string)null,
                team = (string)null,
                teamId = (string)null,
                extension = new
                {
                    build = "0",
                    buildEnv = "0",
                    version = "0",
                    versionFormatted = "0",
                },
                traceLevel = "verbose"
            });
        }

        public async Task<BootstrapState> GetBootstrapAsync(StateResponse state)
        {
            var repos = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streams = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teams = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreads = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var users = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferences = await Rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");

            BootstrapState bs = new BootstrapState();
            bs.Capabilities = state.State.Capabilities;
            bs.CurrentUserId = state.State.UserId;
            bs.CurrentTeamId = state.State.TeamId;
            bs.Configs = new Config()
            {
                ServerUrl = state.State.ServerUrl,
                Email = state.State.Email
            };
            bs.Env = state.State.Environment;

            bs.Repos = repos.Value<JToken>("repos").ToObject<List<CSRepository>>();
            bs.Streams = streams.Value<JToken>("streams").ToObject<List<CSStream>>();
            bs.Teams = teams.Value<JToken>("teams").ToObject<List<Team>>();
            bs.Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CSUnreads>();
            bs.Users = users.Value<JToken>("users").ToObject<List<CSUser>>();
            bs.Services = new Service()
            {
                //TODO
                Vsls = true
            };

            return bs;
        }
    }
}