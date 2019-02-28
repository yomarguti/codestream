using System.Windows.Forms.VisualStyles;

namespace CodeStream.VisualStudio.Models
{
    public class EmptyRequestTypeParams {}

    //public static class Foo
    //{
    //    public static RequestType<EmptyRequestTypeParams> GoToSlackSigninRequestType = new RequestType<EmptyRequestTypeParams>("extension/go-to-slack-signin");
    //}

    public class GoToSlackSigninRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/go-to-slack-signin";
        public override string Method => MethodName;
    }

    public class StartSignupRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/go-to-signup";
        public override string Method => MethodName;
    }

    public class SignOutRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/sign-out";
        public override string Method => MethodName;
    }

    public class ValidateSignupRequest
    {
        public string Token { get; set; }
    }
    public class ValidateSignupRequestType : RequestType<ValidateSignupRequest>
    {
        public const string MethodName = "extension/validate-signup";
        public override string Method => MethodName;
    }

    public class LoginRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/authenticate";
        public override string Method => MethodName;
    }

    public class GetViewBootstrapDataRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/bootstrap";
        public override string Method => MethodName;
    }

    public class MuteAllConversationsRequestTypeParams
    {
        public bool Mute { get; set; }
    }
    public class MuteAllConversationsRequestType : RequestType<MuteAllConversationsRequestTypeParams>
    {
        public const string MethodName = "extension/mute-all";
        public override string Method => MethodName; 
    }

    public class ShowMarkersInEditorRequestTypeParams
    {
        public bool Enable { get; set; }
    }

    public class ShowMarkersInEditorRequestType : RequestType<ShowMarkersInEditorRequestTypeParams>
    {
        public const string MethodName = "extension/show-markers";
        public override string Method => MethodName;
    }

    public class OpenCommentOnSelectInEditorRequestTypeParams
    {
        public bool Enable { get; set; }
    }
    public class OpenCommentOnSelectInEditorRequestType : RequestType<OpenCommentOnSelectInEditorRequestTypeParams>
    {
        public const string MethodName = "extension/open-comment-on-select";
        public override string Method => MethodName;
    }

    public class ShowCodeRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/show-code";
        public override string Method => MethodName;
    }

    public class HighlightCodeRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/highlight-code";
        public override string Method => MethodName;
    }

    public class RevealFileLineRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/reveal-line";
        public override string Method => MethodName;
    }

    public class StartCommentOnLineRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/start-comment-on-line";
        public override string Method => MethodName;
    }

    public class ReloadWebviewRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/reload-webview";
        public override string Method => MethodName;
    }

    public class InviteToLiveShareRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/invite-to-liveshare";
        public override string Method => MethodName;
    }
    public class StartLiveShareRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/start-liveshare";
        public override string Method => MethodName;
    }

    public class JoinLiveShareRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/join-liveshare";
        public override string Method => MethodName;
    }
    public class ShowDiffRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/show-diff";
        public override string Method => MethodName;
    }

    public class ApplyPatchRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "extension/apply-patch";
        public override string Method => MethodName;
    }
}
