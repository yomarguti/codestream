
using CodeStream.VisualStudio.Extensions;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.Serialization;
// ReSharper disable ClassNeverInstantiated.Global

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

    public class SelectedText
    {
        public SelectedText()
        {

        }
		
        public SelectedText(string text)
        {
            Text = text;
        }

        public int StartLine { get; set; }
        public int StartColumn { get; set; }
        public int EndLine { get; set; }
        public int EndColumn { get; set; }
        public string Text { get; set; }

        public bool HasText => Text.IsNotNullOrWhiteSpace();
    }

    /// <summary>
    /// This is a vscode-languageserver model
    /// </summary>
    [DebuggerDisplay("Start Line={StartLine} Char={StartCharacter}, End Line={EndLine} Char={EndCharacter}")]
    public class Range
    {
        public Range(int startLine, int startCharacter, int endLine, int endCharacter)
        {
            StartLine = startLine;
            StartCharacter = startCharacter;
            EndLine = endLine;
            EndCharacter = endCharacter;
        }

        public Range(SelectedText text)
        {
            StartLine = text.StartLine;
            StartCharacter = text.StartColumn;
            EndLine = text.EndLine;
            EndCharacter = text.EndColumn;
        }

        /// <summary>
        /// formats a range as [StartLine, StartCharacter, EndLine, EndCharacter]
        /// </summary>
        /// <returns></returns>
        public int[] ToLocation()
        {
            return new[] { StartLine, StartCharacter, EndLine, EndCharacter };
        }

        public int StartLine { get; }
        public int StartCharacter { get; }
        public int EndLine { get; }
        public int EndCharacter { get; }
    }

    public class CsEntity
    {
        private long _createdAt;
        private long _modifiedAt;

        public bool Deactivated { get; set; }

        public long CreatedAt
        {
            get => _createdAt;
            set
            {
                _createdAt = value;
                CreateAtDateTime = value.FromLong().ToLocalTime();
            }
        }

        public DateTime CreateAtDateTime { get; private set; }

        public long ModifiedAt
        {
            get => _modifiedAt;
            set
            {
                _modifiedAt = value;
                ModifiedAtDateTime = value.FromLong().ToLocalTime();
            }
        }

        public DateTime ModifiedAtDateTime { get; private set; }

        public string Id { get; set; }
        // ReSharper disable once InconsistentNaming
        public string _Id { get; set; }
        public string CreatorId { get; set; }
        public int Version { get; set; }
    }

    public class File
    {
        public string Mimetype { get; set; }
        public string Name { get; set; }
        public string Title { get; set; }
        public string Type { get; set; }
        public string Url { get; set; }

        //TODO this is some kind string | object
        //public Preview Preview {get;set;}

    }
    public class CsPost : CsEntity
    {
        public string TeamId { get; set; }
        public string StreamId { get; set; }
        public string ParentPostId { get; set; }
        public int NumReplies { get; set; }
        public string Text { get; set; }
        public object SeqNum { get; set; }
        public bool HasBeenEdited { get; set; }
        public List<string> MentionedUserIds { get; set; }
        public string Origin { get; set; } //?: "email" | "slack" | "teams";
        public Dictionary<string, bool> Reactions { get; set; }

        public string CodemarkId { get; set; }
        public List<File> Files { get; set; }
    }

    public class CsFullPost : CsPost
    {
        public CsFullCodemark Codemark { get; set; }
        public bool? HasMarkers { get; set; }
    }

    public class Team : CsEntity
    {
        public string Name { get; set; }
        public List<string> MemberIds { get; set; }
        public List<string> AdminIds { get; set; }
        public string PrimaryReferral { get; set; }
    }

    public class Company : CsEntity
    {
        public string Name { get; set; }
        public List<string> TeamIds { get; set; }
    }

    public interface ICsStream { }

    public enum ProviderType
    {
        Slack
    }

    public class CsMarker : CsEntity
    {
        public string TeamId { get; set; }
        public string FileStreamId { get; set; }
        public string PostStreamId { get; set; }
        public string PostId { get; set; }
        public string CodemarkId { get; set; }
        public ProviderType? ProviderType { get; set; }
        public string CommitHashWhenCreated { get; set; }
        /// <summary>
        /// this is // export type CSLocationArray = [number, number, number, number, CSLocationMeta | undefined];
        /// </summary>
        public List<object> LocationWhenCreated { get; set; }
        public string Code { get; set; }
        public string File { get; set; }
        public string Repo { get; set; }
        public string RepoId { get; set; }

        public Range LocationWhenCreatedAsRange
        {
            get
            {
                if (LocationWhenCreated != null && LocationWhenCreated.Count >= 4)
                {
                    return new Range(LocationWhenCreated[0].ToInt(), LocationWhenCreated[1].ToInt(),
                        LocationWhenCreated[2].ToInt(), LocationWhenCreated[3].ToInt());

                }
                return null;
            }
        }
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

    public class MarkerNotLocated : CsMarker
    {
        public string NotLocatedReason { get; set; }//: MarkerNotLocatedReason;
        public string NotLocatedDetails { get; set; }
    }

    public class CsMarkerLocations
    {
        public string TeamId { get; set; }
        public string StreamId { get; set; }
        public string CommitHash { get; set; }
        // TODO this is a bizarro shaped object
        public Dictionary<string, List<object>> Locations { get; set; }
    }

    public class CsCodemark : CsEntity
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

    public class CsRangePoint
    {
        public int Line { get; set; }
        public int Character { get; set; }
    }

    public class CsRange
    {
        public CsRangePoint Start { get; set; }
        public CsRangePoint End { get; set; }
    }

    public class CsFullMarker : CsMarker
    {
        public CsRange Range { get; set; }
        public CsCodemark Codemark { get; set; }

        public string Summary
        {
            get
            {
                return Codemark?.Title.IsNotNullOrWhiteSpace() == true ? Codemark.Title : Codemark?.Text;
            }
        }
    }

    public class CsFullCodemark : CsMarker
    {
        public List<CsMarker> Markers { get; set; }
    }

    public class CsStream : CsEntity
    {
        public CsStream()
        {
            MemberIds = new List<string>();
        }

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

    public class CsFileStream : CsStream
    {

    }

    [Serializable]
    public class CsMePreferences : Dictionary<string, object>
    {
        public CsMePreferences()
        {

        }

        protected CsMePreferences(SerializationInfo info, StreamingContext context) : base(info, context)
        {

        }
    }

    public class Preferences
    {
        public bool TelemetryConsent { get; set; }
        public Dictionary<string, bool> MutedStreams { get; set; }
    }

    public class CsUnreads
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
        public string Team { get; set; }
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

        public List<CsRepository> Repos { get; set; }

        //   public List<CSPost> Posts { get; set; }
        public List<CsStream> Streams { get; set; }
        public List<Team> Teams { get; set; }
        public CsUnreads Unreads { get; set; }
        public List<CsUser> Users { get; set; }
        public CsMePreferences Preferences { get; set; }
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
        public string Error { get; set; }
    }
    public class LoginResponseWrapper
    {
        public Result Result { get; set; }
    }

    public class CsTeam : CsEntity
    {
        public string Name { get; set; }
    }

    public class CsUser : CsEntity
    {
        public List<string> CompanyIds { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string FullName { get; set; }
        public bool IsRegistered { get; set; }
        // ReSharper disable once InconsistentNaming
        public string IWorkOn { get; set; }
        public string LastName { get; set; }
        public long LastPostCreatedAt { get; set; }
        public int NumMentions { get; set; }
        public int NumInvites { get; set; }
        public long RegisteredAt { get; set; }
        public List<string> SecondaryEmails { get; set; }
        public List<string> TeamIds { get; set; }
        public string TimeZone { get; set; }
        public int TotalPosts { get; set; }
        public string Username { get; set; }
        public CsAvatar Avatar { get; set; }
        public bool? Dnd { get; set; }
        public string Presence { get; set; }
        public CsMePreferences Preferences { get; set; }

        public string Name
        {
            get { return Username ?? FullName; }
        }
    }

    public class CsAvatar
    {
        public string Image { get; set; }
        public string Image48 { get; set; }
    }

    public class CsRemote
    {
        public string Url { get; set; }
        public string NormalizedUrl { get; set; }
        public string CompanyIdentifier { get; set; }
    }

    public class CsRepository
    {
        public string Name { get; set; }
        public List<CsRemote> Remotes { get; set; }
        public string TeamId { get; set; }
    }

    public class LoginResponse
    {
        public CsUser User { get; set; }
        public string AccessToken { get; set; }
        public string PubNubKey { get; set; }
        public List<Team> Teams { get; set; }
        public List<Company> Companies { get; set; }
        public List<CsRepository> Repos { get; set; }
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

    public class Ide
    {
        public string Name { get; set; }
        public string Version { get; set; }
    }

    public class Proxy
    {
        public string Url { get; set; }
        public bool StrictSsl { get; set; }
    }

    public class InitializationOptions
    {
        //public string ServerUrl { get; set; }
        //public string GitPath { get; set; }
        //public string Type { get; set; }
        //public string Email { get; set; }
        //public string PasswordOrToken { get; set; }
        //public Extension Extension { get; set; }

        public string TraceLevel { get; set; }
        public bool IsDebugging { get; set; }
        //public IDE Ide { get; set; }

        //public Proxy Proxy { get; set; }
    }


    public class WebviewIpcGenericMessageResponse
    {
        public WebviewIpcGenericMessageResponse(string type)
        {
            Type = type;
        }

        public string Id { get; set; }
        public string Type { get; private set; }
        public object Body { get; set; }
    }

    public class WebviewIpcMessageResponse
    {
        public WebviewIpcMessageResponse()
        {
            Type = "codestream:response";
        }

        public WebviewIpcMessageResponse(WebviewIpcMessageResponseBody body)
        {
            Body = body;
            Type = "codestream:response";
        }
        public string Id { get; set; }
        public string Type { get; private set; }
        public WebviewIpcMessageResponseBody Body { get; set; }
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

    public class CreatePostResponse
    {
        public CsFullPost Post { get; set; }
        public CsFullCodemark Codemark { get; set; }
        public List<CsMarker> Markers { get; set; }

        public List<CsMarkerLocations> MarkerLocations { get; set; }
        public List<CsStream> Streams { get; set; }
        public List<CsRepository> Repos { get; set; }
    }

    public class ShowCodeResponse
    {
        public CsMarker Marker { get; set; }
        public bool EnteringThread { get; set; }
        public string Source { get; set; }
    }

    public class SourceRemote
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    public class SourceAuthor
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    public class Source
    {
        public string File { get; set; }
        public string RepoPath { get; set; }
        public string Revision { get; set; }
        public List<SourceAuthor> Authors { get; set; }
        public List<SourceRemote> Remotes { get; set; }
    }

    public class DidSelectCodeNotification
    {
        public string Type { get; set; }
        public DidSelectCodeNotificationBody Body { get; set; }
    }

    public class DidSelectCodeNotificationBody
    {
        public string Code { get; set; }
        public string File { get; set; }
        public string FileUri { get; set; }
        public int[] Location { get; set; }
        public Source Source { get; set; }
        public string GitError { get; set; }
        public bool? IsHightlight { get; set; }
    }

    public class DidChangeStreamThreadNotification
    {
        public string Type { get; set; }
        public DidChangeStreamThreadNotificationBody Body { get; set; }
    }

    public class DidChangeStreamThreadNotificationBody
    {
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
    }

    public class DidChangeActiveEditorNotification
    {
        public string Type { get; set; }
        public DidChangeActiveEditorNotificationBody Body { get; set; }
    }

    public class DidChangeActiveEditorNotificationBody
    {
        public DidChangeActiveEditorNotificationBodyEditor Editor { get; set; }
    }
    public class DidChangeActiveEditorNotificationBodyEditor
    {
        public string FileStreamId { get; set; }
        public string Uri { get; set; }
        public string FileName { get; set; }
        public string LanguageId { get; set; }
    }

    public class ServiceRequest
    {
        public string Service { get; set; }
        public ServiceRequestAction Action { get; set; }
    }

    public class ServiceRequestAction
    {
        public string Type { get; set; }
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
        public bool CreateNewStream { get; set; }
    }

    public class StreamThread
    {
        /// <summary>
        /// Thread Id
        /// </summary>
        public string Id { get; set; }

        public CsStream Stream { get; set; }
    }
}
