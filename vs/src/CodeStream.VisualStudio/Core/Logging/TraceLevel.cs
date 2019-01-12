namespace CodeStream.VisualStudio.Core.Logging
{
    public enum TraceLevel
    {
        Silent,
        Errors,
        Info,
        Debug,
        Verbose
    }

    public static class TraceLevelExtensions
    {
        public static string ToJsonValue(this TraceLevel traceLevel) => traceLevel.ToString().ToLowerInvariant();
    }
}