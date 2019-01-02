using System;

namespace CodeStream.VisualStudio
{
    public static class Guids
    {
        // Window Ids
        public static Guid WebViewToolWindowGuid = new Guid(WebViewToolWindowId);
        public const string WebViewToolWindowId = "0fae43ec-bc2d-417e-af01-a477439cf228";

        // VisualStudio IDs
        // none

        // UIContexts
        // none

        // Packages
        public const string CodeStreamPackageId = "5918a618-0520-4134-9133-4d8d4242ac6e";
        public const string ServiceProviderPackageId = "D5CE1488-DEDE-426D-9E5B-BFCCFBE33E54";
        public const string WebViewPackageId = "330ce502-4e1f-44b8-ab32-82a7ea71beeb";

        // Guids defined in CodeStreamPackage.vsct
        public const string ToggleToolWindowCommandCmdSet = "8a64bc5c-4166-4180-b7a6-e1a24a8f790f";
        public const string AuthenticationCommandCmdSet = "9a64bc5c-4166-4180-b7a6-e1a24a8f790f";

        // Others
        public const string LanguageClientId = "DE885E15-D44E-40B1-A370-45372EFC23AA";
    }
}
