using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;

// ReSharper disable ClassNeverInstantiated.Global

namespace CodeStream.VisualStudio.Models
{
    public class TextSelection
    {
        public Range Range { get; set; }
        public string Text { get; set; }
        public bool HasText => !Text.IsNullOrWhiteSpace();
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
        public object Preview { get; set; }
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
        public Dictionary<string, List<string>> Reactions { get; set; }

        public string CodemarkId { get; set; }
        public List<File> Files { get; set; }
    }

    public class CsFullPost : CsPost
    {
        public CsFullCodemark Codemark { get; set; }
        public bool? HasMarkers { get; set; }
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
    }

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

    public class DocumentMarker : CsMarker
    {
        public CsCodemark Codemark { get; set; }
        public string CreatorName { get; set; }
        public Range Range { get; set; }
        public string Summary { get; set; }
        public string SummaryMarkdown { get; set; }
    }

    public class CsFullCodemark : CsMarker
    {
        public List<CsMarker> Markers { get; set; }
    }

    // TODO these stream objects are not nice

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

    public class CsDirectStream : CsStream
    {
    }

    public class CsFileStream : CsStream
    {

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
        public bool? Dnd { get; set; }
        public string Presence { get; set; }

        public string Name
        {
            get { return Username ?? FullName; }
        }
    }

    public class CsTeam
    {
        public string Id { get; set; }
        public string Name { get; set; }
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

    [JsonConverter(typeof(StringEnumConverter))]
    public enum ProxySupport
    {
        On,
        Off,
        Override,
    }

    public class InitializationOptions
    {
        //public string ServerUrl { get; set; }
        //public string GitPath { get; set; }

        public Ide Ide { get; set; }
        public Extension Extension { get; set; }
        public string TraceLevel { get; set; }
        public bool IsDebugging { get; set; }
        public string ProxySupport { get; set; }
        public Proxy Proxy { get; set; }
    }

    /// <summary>
    /// Thin wrapper for plucking out JToken properties
    /// </summary>
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
        public string Username { get; set; }
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
        public Range Range { get; set; }
        public Source Source { get; set; }
        public string GitError { get; set; }
        public bool? IsHighlight { get; set; }
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
        public string Url { get; set; }
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
        public bool CreateNewStream { get; set; }

        public object UserId { get; set; } //string | string[]
    }

    public class StreamThread
    {
        public StreamThread(string threadId, CsStream stream)
        {
            Id = threadId;
            Stream = stream;
        }

        /// <summary>
        /// Thread Id
        /// </summary>
        public string Id { get; }

        public CsStream Stream { get; }
    }

    public class TelemetryRequest
    {
        public string EventName { get; set; }
        public Dictionary<string, object> Properties { get; set; }
    }

    public class PrepareCodeRequest
    {
        public TextDocumentIdentifier TextDocument { get; set; }
        public Range Range { get; set; }
        public bool Dirty { get; set; }
    }

    public class PrepareCodeResponse
    {
        public string Code { get; set; }
        public Range Range { get; set; }
        public string GitError { get; set; }
        public Source Source { get; set; }
    }

    public class FetchCodemarksRequest
    {
        public string StreamId { get; set; }
    }

    public class FetchCodemarksResponse
    {
        public List<CsMarker> Markers { get; set; }
        public List<CsFullCodemark> Codemarks { get; set; }
    }

    public class DocumentMarkersRequest
    {
        public TextDocumentIdentifier TextDocument { get; set; }
    }

    public class DocumentMarkersResponse
    {
        public List<DocumentMarker> Markers { get; set; }
        public List<MarkerNotLocated> MarkersNotLocated { get; set; }
    }

    public class FetchPostsRequest
    {
        public string StreamId { get; set; }
        public int? Limit { get; set; }
        public object After { get; set; }
        public object Before { get; set; }
        public bool? Inclusive { get; set; }
    }

    public abstract class LoginRequestBase<T>
    {
        public string ServerUrl { get; set; }
        public string Email { get; set; }
        public T PasswordOrToken { get; set; }
        public string SignupToken { get; set; }
        public string Team { get; set; }
        public string TeamId { get; set; }
        public Extension Extension { get; set; }
        public Ide Ide { get; set; }
        public string TraceLevel { get; set; }
        public bool IsDebugging { get; set; }
    }

    public class LoginAccessToken
    {
        public LoginAccessToken(string email, string url, string value)
        {
            Email = email;
            Url = url;
            Value = value;
        }

        public string Email { get; }
        public string Url { get; }
        public string Value { get; }
    }

    public class LoginRequest : LoginRequestBase<string> { }

    public class LoginViaAccessTokenRequest : LoginRequestBase<LoginAccessToken> { }

    public class LogoutRequest { }

    public class TextDocumentIdentifier
    {
        public string Uri { get; set; }
    }

    public class StreamThreadSelectedRequest
    {
        public string StreamId { get; set; }
        public string ThreadId { get; set; }
    }

    public class DocumentFromMarkerRequest
    {
        public string File { get; set; }
        public string RepoId { get; set; }
        public string MarkerId { get; set; }
        public string Source { get; set; }
    }

    public class DocumentFromMarkerResponse
    {
        public TextDocumentIdentifier TextDocument { get; set; }
        public Range Range { get; set; }
        public string Revision { get; set; }
    }

    public class CreateDirectStreamRequest
    {
        public string Type { get; set; }
        public List<string> MemberIds { get; set; }
    }

    public class GetPostRequest
    {
        public string StreamId { get; set; }
        public string PostId { get; set; }
    }

    public class GetPostResponse
    {
        public CsPost Post { get; set; }
    }

    public class GetUserRequest
    {
        public string UserId { get; set; }
    }

    public class GetUserResponse
    {
        public CsUser User { get; set; }
    }

    public class GetFileStreamRequest
    {
        public TextDocumentIdentifier TextDocument { get; set; }
    }

    public class GetFileStreamResponse
    {
        public CsFileStream Stream { get; set; }
    }

    public class GetStreamRequest
    {
        public string StreamId { get; set; }
        public StreamType? Type { get; set; }
    }

    public class GetStreamResponse
    {
        public CsStream Stream { get; set; }
    }

    public class CreateCodemarkRequestMarker
    {
        public string Code { get; set; }
        public List<string> Remotes { get; set; }
        public string File { get; set; }
        public string CommitHash { get; set; }
        public List<object> Location { get; set; } //CsLocationarray
    }

    public class CreateCodemarkRequest
    {
        public CodemarkType Type { get; set; }
        public ProviderType? ProviderType { get; set; }
        public string Text { get; set; }
        public string StreamId { get; set; }
        public string PostId { get; set; }
        public string ParentPostId { get; set; }
        public string Color { get; set; }
        public string Status { get; set; }
        public string Title { get; set; }
        public List<string> Assignees { get; set; }
        public List<CreateCodemarkRequestMarker> Markers { get; set; }
        public List<string> Remotes { get; set; }
    }

    public class CreatePostRequest
    {
        public string StreamId { get; set; }
        public string Text { get; set; }
        public List<string> MentionedUserIds { get; set; }
        public string ParentPostId { get; set; }
        public CreateCodemarkRequest Codemark { get; set; }
    }

    public class FetchStreamsRequest
    {
        public List<StreamType> Types { get; set; }
        public List<string> MemberIds { get; set; }
    }
    public class FetchStreamsRequest2
    {
        public List<string> Types { get; set; }
        public List<string> MemberIds { get; set; }
    }

    public class FetchStreamsResponse
    {
        public List<CsStream> Streams { get; set; }
    }
}
