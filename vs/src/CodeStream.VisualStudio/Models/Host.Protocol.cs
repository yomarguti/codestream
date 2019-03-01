namespace CodeStream.VisualStudio.Models
{
    public class EmptyRequestTypeParams { }

    //public static class Foo
    //{
    //    public static RequestType<EmptyRequestTypeParams> GoToSlackSigninRequestType = new RequestType<EmptyRequestTypeParams>("extension/go-to-slack-signin");
    //}

    public class GetViewBootstrapDataRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/bootstrap";
        public override string Method => MethodName;
    }

    public class LoginRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/login";
        public override string Method => MethodName;
    }

    public class SignOutRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/logout";
        public override string Method => MethodName;
    }

    public class SlackLoginRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/slack/login";
        public override string Method => MethodName;
    }

    public class SignupRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/signup";
        public override string Method => MethodName;
    }
    public class CompleteSignupRequest
    {
        public string Token { get; set; }
    }
    public class CompleteSignupRequestType : RequestType<CompleteSignupRequest>
    {
        public const string MethodName = "host/signup/complete";
        public override string Method => MethodName;
    }

    public class ReloadWebviewRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/webview/reload";
        public override string Method => MethodName;
    }

    public class StartCommentOnLineRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/start-comment-on-line";
        public override string Method => MethodName;
    }

    public class CompareMarkerRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/marker/compare";
        public override string Method => MethodName;
    }

    public class ApplyMarkerRequestType : RequestType<EmptyRequestTypeParams>
    {
        public const string MethodName = "host/marker/apply";
        public override string Method => MethodName;
    }

    public class UpdateConfigurationRequest
    {
        public string Name { get; set; }
        public string Value { get; set; }
    }

    public class UpdateConfigurationRequestType : RequestType<UpdateConfigurationRequest>
    {
        public const string MethodName = "host/configuration/update";
        public override string Method => MethodName;
    }
}
