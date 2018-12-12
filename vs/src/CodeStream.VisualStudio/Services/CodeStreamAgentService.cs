using CodeStream.VisualStudio.Models;
using Newtonsoft.Json.Linq;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public class CodestreamAgentService
    {
        #region Singleton
        private static readonly Lazy<CodestreamAgentService> lazy = new Lazy<CodestreamAgentService>(() => new CodestreamAgentService());
        public static CodestreamAgentService Instance { get { return lazy.Value; } }
        private CodestreamAgentService() { }
        #endregion

        private JsonRpc _rpc { get; set; }

        public void SetRpc(JsonRpc rpc)
        {
            _rpc = rpc;
        }

        public async Task<object> SendAsync(string name, JToken arguments)
        {
            try
            {
                return await _rpc.InvokeWithParameterObjectAsync<object>(name, arguments);
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        public async Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            return await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/cli/login", new
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
            var repos =            await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streams =          await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teams =            await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreads =     await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var users =            await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferences = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");

            var bootstrapState = new BootstrapState
            {
                Capabilities = state.State.Capabilities,
                CurrentUserId = state.State.UserId,
                CurrentTeamId = state.State.TeamId,
                Configs = new Config()
                {
                    ServerUrl = state.State.ServerUrl,
                    Email = state.State.Email
                },
                Env = state.State.Environment,

                Repos = repos.Value<JToken>("repos").ToObject<List<CSRepository>>(),
                Streams = streams.Value<JToken>("streams").ToObject<List<CSStream>>(),
                Teams = teams.Value<JToken>("teams").ToObject<List<Team>>(),
                Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CSUnreads>(),
                Users = users.Value<JToken>("users").ToObject<List<CSUser>>(),
                Services = new Service()
                {
                    //TODO
                    Vsls = false
                }
            };

            return bootstrapState;
        }
    }
}