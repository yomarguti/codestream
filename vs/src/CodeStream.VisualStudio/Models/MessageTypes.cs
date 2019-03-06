using System.Diagnostics;
using CodeStream.VisualStudio.Extensions;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.Models
{
    public interface IAbstractMessageType
    {
        string Id { get; }
        string Method { get; }
        string Error { get; set; }
        string AsJson();
    }

    public interface INotificationType : IAbstractMessageType { }

    public interface IRequestType : IAbstractMessageType { }

    public interface IAbstractMessageType<T> : IAbstractMessageType
    {
        T Params { get; set; }
    }

    [DebuggerDisplay("Method={Method}")]
    public abstract class AbstractMessageType<T> : IAbstractMessageType<T>
    {
        /// <summary>
        /// The method to be invoked.
        /// </summary>
        public abstract string Method { get; }

        public string Id { get; set; }

        public T Params { get; set; }

        public string Error { get; set; }

        public virtual string AsJson()
        {
            return ToResponseMessage(Id, Method, JToken.Parse(Params.ToJson()), Error);
        }

        protected static string ToResponseMessage(string id, string method, JToken @params, string error)
        {
            var result = new JObject();
            if (!id.IsNullOrWhiteSpace())
            {
                result["id"] = id;
            }
            if (!method.IsNullOrWhiteSpace())
            {
                result["method"] = method;
            }
            if (@params != null)
            {
                result["params"] = @params;
            }
            if (!error.IsNullOrWhiteSpace())
            {
                result["error"] = error;
            }

            var r = result.ToString();
            return r;
        }
    }

    [DebuggerDisplay("Method={Method}")]
    public abstract class RequestType<T> : AbstractMessageType<T>, IRequestType { }

    [DebuggerDisplay("Method={Method}")]
    public abstract class NotificationType<T> : AbstractMessageType<T>, INotificationType { }
}
