using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Extensions;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Models
{
    public class Ipc
    {
        public static string ToResponseMessage(string id, bool @params, string error = null)
        {
            return ToResponseMessage(id, @params.ToString().ToLower(), error);
        }

        public static string ToResponseMessage(string id, JToken @params, JToken error = null)
        {
            return ToResponseMessage(id, @params?.ToString(), error?.ToString());
        }

        public static string ToResponseMessage(string id, JToken @params, string error = null)
        {
            return ToResponseMessage(id, @params?.ToString(), error);
        }

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
