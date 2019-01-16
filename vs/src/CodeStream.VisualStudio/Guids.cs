using System;

namespace CodeStream.VisualStudio
{
    public static class Guids
    {
        // Window Ids
        public static Guid WebViewToolWindowGuid = new Guid(WebViewToolWindowId);
        public const string WebViewToolWindowId = "882ebf5e-eccc-49c1-a303-b113742c8bf5";

        // Packages
        public const string CodeStreamPackageId = "dd6d0f58-10a8-4838-85b2-40b57f9cdf58";
        public const string ServiceProviderPackageId = "2e5983fb-7dbc-458e-b8f1-8561684049d0";

        // Others
        public const string LanguageClientId = "4d480d5e-ab28-4e9c-b0be-32cd08f3b8ea";
    }
}
