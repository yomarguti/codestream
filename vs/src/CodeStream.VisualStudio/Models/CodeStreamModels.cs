using CodeStream.VisualStudio.Services;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Models
{
    public class CSPost
    {

    }

    public class Team : CSEntityBase
    {
        public string Name { get; set; }
        public List<string> MemberIds { get; set; }
        public List<string> AdminIds { get; set; }
        public string PrimaryReferral { get; set; }
    }

    public class Company : CSEntityBase
    {
        public string Name { get; set; }
        public List<string> TeamIds { get; set; }
    }

    public interface ICSStream { }

    public class CSEntityBase
    {
        public bool Deactivated { get; set; }
        public long CreatedAt { get; set; }
        public long ModifiedAt { get; set; }
        public string Id { get; set; }
        public string _Id { get; set; }
        public string CreatorId { get; set; }
        public int Version { get; set; }
    }

    public enum ProviderType
    {
        Slack
    }

    public class CSMarker : CSEntityBase
    {
        public string TeamId { get; set; }
        public string FileStreamId { get; set; }
        public string PostStreamId { get; set; }
        public string PostId { get; set; }
        public string CodemarkId { get; set; }
        public ProviderType? ProviderType { get; set; }
        public string CommitHashWhenCreated { get; set; }
        public object LocationWhenCreated { get; set; } //CSLocationArray
        public string Code { get; set; }
        public string File { get; set; }
        public string Repo { get; set; }
        public string RepoId { get; set; }
    }

    public enum CodemarkType
    {
        Comment,
        Issue,
        Bookmark,
        Question,
        Trap
    }

    //export enum MarkerNotLocatedReason
    //{
    //    MISSING_ORIGINAL_LOCATION = "missing original location",
    //    MISSING_ORIGINAL_COMMIT = "missing original commit",
    //    CODEBLOCK_DELETED = "code block deleted",
    //    UNKNOWN = "unknown"
    //}

    public class MarkerNotLocated : CSMarker
    {
        public string NotLocatedReason { get; set; }//: MarkerNotLocatedReason;
        public string NotLocatedDetails { get; set; }
    }

    public class CSCodemark : CSEntityBase
    {
        public string TeamId { get; set; }
        public string StreamId { get; set; }
        public string PostId { get; set; }
        public string ParentPostId { get; set; }
        public List<string> MarkerIds { get; set; }
        public List<string> FileStreamIds { get; set; }
        public ProviderType? ProviderType { get; set; }
        public CodemarkType Type { get; set; }
        public string Color { get; set; }
        public string Status { get; set; }
        public string Title { get; set; }
        public List<string> Assignees { get; set; }
        public string Text { get; set; }
        public int NumReplies { get; set; }
    }

    public class CSRangePoint
    {
        public int Line { get; set; }
        public int Character { get; set; }
    }

    public class CSRange
    {
        public CSRangePoint Start { get; set; }
        public CSRangePoint End { get; set; }
    }

    public class CSFullMarker : CSMarker
    {
        public CSRange Range { get; set; }
        public CSCodemark Codemark { get; set; }
    }

    public class CSFullCodemark : CSMarker
    {
        public List<CSMarker> Markers { get; set; }
    }

    public class CSStream : CSEntityBase
    {
        public CSStream()
        {
            MemberIds = new List<string>();
        }

        //file
        public bool IsArchived { get; set; }
        public string Privacy { get; set; }
        public string SortId { get; set; }
        public string TeamId { get; set; }
        public long? MostRecentPostCreatedAt { get; set; }
        public string MostRecentPostId { get; set; }
        public string Purpose { get; set; }
        public string Type { get; set; }
        public string File { get; set; }
        public string RepoId { get; set; }
        public int NumMarkers { get; set; }
        public object EditingUSsrs { get; set; }

        //direct
        public bool? IsClosed { get; set; }
        public string Name { get; set; }
        public List<string> MemberIds { get; set; }
        public int? Priority { get; set; }

        //channel stream
        public bool IsTeamStream { get; set; }
        public string ServiceType { get; set; }
        public string ServiceKey { get; set; }
        public Dictionary<string, object> ServiceInfo { get; set; }
    }

    public class CSMePreferences
    {
    }

    public class Preferences
    {
        public bool TelemetryConsent { get; set; }
        public Dictionary<string, bool> MutedStreams { get; set; }
    }
    public class CSUnreads
    {
        public Dictionary<string, int> LastReads { get; set; }
        public Dictionary<string, int> Mentions { get; set; }
        public Dictionary<string, int> Unreads { get; set; }
        public int TotalMentions { get; set; }
        public int TotalUnreads { get; set; }
    }

    public class Config
    {
        public bool Debug { get; set; }
        public string Email { get; set; }
        public bool MuteAll { get; set; }
        public string ServerUrl { get; set; }
        public bool ShowHeadshots { get; set; }
        public bool ShowMarkers { get; set; }
        public bool OpenCommentOnSelect { get; set; }
    }

    public class Service
    {
        public bool Vsls { get; set; }
    }

    //public enum CodeStreamEnvironment
    //{
    //    Local,
    //    Prod,
    //    Unknown
    //}

    public class BootstrapState
    {
        public Capabilities Capabilities { get; set; }
        public Config Configs { get; set; }
        public string CurrentUserId { get; set; }
        public string CurrentTeamId { get; set; }
        public string CurrentStreamId { get; set; }
        public string CurrentThreadId { get; set; }
        public string Env { get; set; }

        public List<CSRepository> Repos { get; set; }

        //   public List<CSPost> Posts { get; set; }
        public List<CSStream> Streams { get; set; }
        public List<Team> Teams { get; set; }
        public CSUnreads Unreads { get; set; }
        public List<CSUser> Users { get; set; }
        public CSMePreferences Preferences { get; set; }
        public Service Services { get; set; }
        public string Version { get; set; }
        public List<string> PanelStack { get; set; }
    }

    public class Capabilities
    {
        public bool Mute { get; set; }
    }

    public class Result
    {
        public LoginResponse LoginResponse { get; set; }
        public State State { get; set; }
    }
    public class LoginResponseWrapper
    {
        public Result Result { get; set; }
    }

    public class CSUser : CSEntityBase
    {
        public string PhoneNumber { get; set; }
        public string IWorkOn { get; set; }
        public List<object> ProviderIdentities { get; set; }
        public string Email { get; set; }
        public string Username { get; set; }
        public string TimeZone { get; set; }
        public bool IsRegistered { get; set; }
        public long RegisteredAt { get; set; }
        public string JoinMethod { get; set; }
        public string PrimaryReferral { get; set; }
        public string OriginTeamId { get; set; }
        public List<string> CompanyIds { get; set; }
        public List<string> TeamIds { get; set; }
        public long LastLogin { get; set; }
        public Preferences Preferences { get; set; }
        public string AccessToken { get; set; }
        public string PubNubKey { get; set; }
        public string PubNubToken { get; set; }
    }

    public class CSRemote
    {
        public string Url { get; set; }
        public string NormalizedUrl { get; set; }
        public string CompanyIdentifier { get; set; }
    }

    public class CSRepository
    {
        public string Name { get; set; }
        public List<CSRemote> Remotes { get; set; }
        public string TeamId { get; set; }
    }

    public class LoginResponse
    {
        public CSUser User { get; set; }
        public string AccessToken { get; set; }
        public string PubNubKey { get; set; }
        public List<Team> Teams { get; set; }
        public List<Company> Companies { get; set; }
        public List<CSRepository> Repos { get; set; }
        public string TeamId { get; set; }
    } 

    public class State
    {
        public State()
        {
            Capabilities = new Capabilities();
        }

        public string ApiToken { get; set; }
        public string Email { get; set; }
        public Capabilities Capabilities { get; set; }
        public string Environment { get; set; }
        public string ServerUrl { get; set; }
        public string TeamId { get; set; }
        public string UserId { get; set; }
    }


    public class Extension
    {
        public string Build { get; set; }
        public string BuildEnv { get; set; }
        public string Version { get; set; }
        public string VersionFormatted { get; set; }
    }
    public class IDE
    {
        public string Name { get; set; }
        public string Version { get; set; }
    }
    public class Proxy
    {
        public string Url { get; set; }
        public bool StrictSSL { get; set; }
    }
    public class InitializationOptions
    {
        public string ServerUrl { get; set; }
        public string GitPath { get; set; }
        //public string Type { get; set; }
        //public string Email { get; set; }
        //public string PasswordOrToken { get; set; }
        public Extension Extension { get; set; }
        public string TraceLevel { get; set; }
        public bool IsDebugging { get; set; }
        public IDE Ide { get; set; }
        public Proxy Proxy { get; set; }
    }

    public class WebviewIpcMessageResponse
    {
        public string Id { get; set; }
        public string Type { get; set; } = "codestream:response";
        public WebviewIpcMessageResponseBody Body { get; set; }
        public string Error { get; set; }
    }

    public class WebviewIpcMessageResponseBody
    {
        public WebviewIpcMessageResponseBody(string id)
        {
            Id = id;
        }

        public string Id { get; set; }
        public string Type { get; set; }
        public object Payload { get; set; }
        public string Error { get; set; }
    }

    public class WebviewIpcMessageResponsePayload
    {
        public string Env { get; set; }
        public Config Configs { get; set; }
        public Service Services { get; set; }
        public string Version { get; set; }
    }

    public class CodeStreamMessage
    {
        public string Type { get; set; }
        public JToken Body { get; set; }

        public static CodeStreamMessage Empty()
        {
            return new CodeStreamMessage();
        }

        public string Action
        {
            get
            {
                return Body?.Value<string>("action");
            }
        }
        public string Id
        {
            get
            {
                return Body?.Value<string>("id");
            }
        }

        public JToken Params
        {
            get
            {
                return Body.Value<JToken>("params");
            }
        }
    }
}
