using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using Newtonsoft.Json.Linq;
using Serilog;
using System;
using CodeStream.VisualStudio.Core;

namespace CodeStream.VisualStudio.Models
{
    /// <summary>
    /// Thin wrapper for plucking out certain JToken properties
    /// </summary>
    public class WebviewIpcMessage : IAbstractMessageType
    {
        private static readonly ILogger Log = LogManager.ForContext<WebviewIpcMessage>();

        public WebviewIpcMessage(string id)
        {
            Id = id;
            Params = JToken.Parse("{}");
        }

        public WebviewIpcMessage(string id, JToken @params)
        {
            Id = id;
            Params = @params;
        }

        public WebviewIpcMessage(string id, JToken @params, JToken error)
        {
            Id = id;
            Params = @params;
            Error = error;
        }

        public JToken Params { get; set; }

        public string AsJson()
        {
            return Ipc.ToResponseMessage(Id, Params, Error);
        }

        public string Id { get; }

        public string Method { get; set; }

        public JToken Error { get; set; }

        public string Target() => Method?.Split(new[] { '/' })[0];

        public static WebviewIpcMessage New() => new WebviewIpcMessage(null);

        public static WebviewIpcMessage Parse(string token) => Parse(JToken.Parse(token));

        public static WebviewIpcMessage Parse(JToken token)
        {
            string method = null;
            try
            {
                method = token.Value<string>("method");
                return new WebviewIpcMessage(token.Value<string>("id"), token.Value<JToken>("params"))
                {
                    
                    Method = method,
                    Error = token.Value<JToken>("error"),
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Token could not be parsed. Type={Type}", method);
            }

            return WebviewIpcMessage.New();
        }

        private static class Ipc
        {
            public static string ToResponseMessage(string id, JToken @params, JToken error = null)
            {
                return ToResponseMessage(id, @params?.ToString(), error?.ToString());
            }

            // ReSharper disable once MemberCanBePrivate.Local
            public static string ToResponseMessage(string id, string @params, string error = null)
            {
                @params = GetParams(@params);

                if (error.IsNullOrWhiteSpace())
                {
                    return @"{""id"":""" + id + @""",""params"":" + @params + @"}";
                }
                else
                {
                    if (@params.IsNullOrWhiteSpace())
                    {
                        return @"{""id"":""" + id + @""",""error"":""" + error + @"""}";
                    }

                    return @"{""id"":""" + id + @""",""params"":" + @params + @",""error"":""" + error + @"""}}";
                }
            }

            private static string GetParams(string @params)
            {
                if (@params == null)
                {
                    return null;
                }

                if (@params == string.Empty)
                {
                    return "\"\"";
                }

                // this is sucky, but since we're dealing with strings here...
                if (!@params.StartsWith("{") && !@params.StartsWith("[") && @params != "true" && @params != "false" && !RegularExpressions.Number.IsMatch(@params))
                {
                    return $"\"{@params}\"";
                }

                return @params;
            }
        }
    }
}