using System;

namespace CodeStream.VisualStudio
{
    public static class Guids
    {
        // Window Ids
        public static Guid WebViewToolWindowGuid = new Guid(WebViewToolWindowId);
        public const string WebViewToolWindowId = "882ebf5e-eccc-49c1-a303-b113742c8bf5";

        // VisualStudio IDs
        // none

        // UIContexts
        // none

        // Packages
        public const string CodeStreamPackageId = "dd6d0f58-10a8-4838-85b2-40b57f9cdf58";
        public const string ServiceProviderPackageId = "2e5983fb-7dbc-458e-b8f1-8561684049d0";
        public const string WebViewPackageId = "62d34db8-65a4-4ce0-a2f7-c6198c043ebc";

        // GUIDs defined in CodeStreamPackage.vsct
        public const string ToggleToolWindowCommandCmdSet = "1cae5929-d500-4d06-8551-1a597650dd31";
        public const string AuthenticationCommandCmdSet = "c6cb9c7f-3e68-4435-b8f8-64c4aa9954d5";
        public const string AddCodemarkCommandCmdSet = "b5696049-b2c5-4454-85ab-da7a6108d115";

        // Others
        public const string LanguageClientId = "4d480d5e-ab28-4e9c-b0be-32cd08f3b8ea";
    }
}
