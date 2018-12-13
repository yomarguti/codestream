using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using System.Collections.Generic;
using System.Linq;

namespace CodeStream.VisualStudio.Extensions
{
    public static class StringExtensions
    {
        public static string ToJson(this object value, bool camelCase = true)
        {
            JsonSerializerSettings settings = null;
            if (camelCase)
            {
                settings = new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                };
            }

            return JsonConvert.SerializeObject(value, settings);
        }

        public static T FromJson<T>(this string value)
        {
            return JsonConvert.DeserializeObject<T>(value);
        }

        public static JToken RemoveFields(this JToken token, params string[] fields)
        {
            var container = token as JContainer;
            if (container == null) return token;

            List<JToken> removeList = new List<JToken>();
            foreach (JToken el in container.Children())
            {
                var p = el as JProperty;
                if (p != null && fields.Contains(p.Name))
                {
                    removeList.Add(el);
                }
                el.RemoveFields(fields);
            }

            foreach (JToken el in removeList)
            {
                el.Remove();
            }

            return token;
        }      
    }
}