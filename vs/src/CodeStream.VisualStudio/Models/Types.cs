using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Models
{
    public enum LoginResult
    {
        // ReSharper disable InconsistentNaming
        SUCCESS,
        INVALID_CREDENTIALS,
        TOKEN_INVALID,
        NOT_CONFIRMED,
        USER_NOT_ON_TEAM,
        UNKNOWN,
        VERSION_UNSUPPORTED
        // ReSharper restore InconsistentNaming
    }

    public enum LogoutReason
    {
        Token,
        Unknown
    }

    public enum ProviderType
    {
        Slack
    }

    public enum CodemarkType
    {
        Comment,
        Issue,
        Bookmark,
        Question,
        Trap,
        Link
    }

    public enum ConnectionStatus
    {
        Disconnected,
        Reconnected,
        Reconnecting,
    }

    public enum StreamType
    {
        channel,
        direct,
        file
    }

    //export enum MarkerNotLocatedReason
    //{
    //    MISSING_ORIGINAL_LOCATION = "missing original location",
    //    MISSING_ORIGINAL_COMMIT = "missing original commit",
    //    CODEBLOCK_DELETED = "code block deleted",
    //    UNKNOWN = "unknown"
    //}

    public static class ChangeDataType
    {
        public const string Codemarks = "codemarks";
        public const string MarkerLocations = "markerLocations";
        public const string Markers = "markers";
        public const string Posts = "posts";
        public const string Preferences = "preferences";
        public const string Repositories = "repos";
        public const string Streams = "streams";
        public const string Teams = "teams";
        public const string Unreads = "unreads";
        public const string Users = "users";
    }
}
