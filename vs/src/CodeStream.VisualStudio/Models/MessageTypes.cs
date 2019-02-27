namespace CodeStream.VisualStudio.Models
{
    public interface IAbstractMessageType
    {
        string Method { get; }
        string AsJson();
    }

    public interface IAbstractMessageType<T> : IAbstractMessageType
    {
        T Params { get; set; }
    }

    public abstract class AbstractMessageType<T> : IAbstractMessageType<T>
    {
        /// <summary>
        /// The method to be invoked.
        /// </summary>
        public abstract string Method { get; }

        public T Params { get; set; }

        public virtual string AsJson()
        {
            return CodeStream.VisualStudio.Extensions.JsonExtensions.ToJson(this);
        }
    }

    public abstract class RequestType<T> : AbstractMessageType<T> { }

    public abstract class NotificationType<T> : AbstractMessageType<T> { }
}
