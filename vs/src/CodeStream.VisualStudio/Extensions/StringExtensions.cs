using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

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
    }
}