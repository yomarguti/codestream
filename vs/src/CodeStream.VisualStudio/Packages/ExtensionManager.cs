using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Packages
{
    /// <summary>
    /// Dynamically loads the correct extension manager to check if certain extensions are installed.
    /// </summary>
    public static class ExtensionManager
    {
        /// <summary>
        /// Names of extensions mapped to their kind
        /// </summary>
        private static readonly Dictionary<string, ExtensionKind> ExtensionMap = new Dictionary<string, ExtensionKind>()
        {
            { "VS Live Share - Preview", ExtensionKind.LiveShare},
            { "VS Live Share", ExtensionKind.LiveShare }
        };

        public static Lazy<Dictionary<ExtensionKind, bool>> InstalledExtensions = new Lazy<Dictionary<ExtensionKind, bool>>(
            () =>
            {
                var installedExtensions = new Dictionary<ExtensionKind, bool>();

                AppDomain domain = null;
                try
                {
                    var appDomainSetup = new AppDomainSetup
                    {
                        ApplicationBase = Environment.CurrentDirectory
                    };
                    domain = AppDomain.CreateDomain($"CodeStream-{Guid.NewGuid()}",
                        AppDomain.CurrentDomain.Evidence,
                        appDomainSetup);

                    var path =
                        $@"\dlls\{Application.VisualStudioVersionYear}\Microsoft.VisualStudio.ExtensionManager.dll";
                    var assembly = domain.LoadFromDisk(path);

                    var installedExtensionsList = PackageExtensions.Invoke<IEnumerable<dynamic>>(
                        assembly.GetType("Microsoft.VisualStudio.ExtensionManager.SVsExtensionManager"),
                        "GetInstalledExtensions");

                    if (installedExtensionsList == null) return installedExtensions;

                    foreach (object extension in installedExtensionsList)
                    {
                        // NOTE: you can't cast extension as dynamic, or you're get a BindingException...
                        // use reflection instead:s
                        var state = extension.GetValue<string>("State");
                        if (state == null || !state.EqualsIgnoreCase("Enabled")) continue;

                        var name = extension.GetValue<string>("Header.Name");
                        if (name.IsNullOrWhiteSpace()) continue;

                        if (ExtensionMap.TryGetValue(name, out ExtensionKind kind))
                        {
                            installedExtensions[kind] = true;
                        }
                    }
                }
                catch (Exception)
                {
                    //sufffffffffer
                }
                finally
                {
                    try
                    {
                        if (domain != null)
                        {
                            AppDomain.Unload(domain);
                        }
                    }
                    catch (Exception)
                    {
                        //sufffffffffer
                    }
                }

                return installedExtensions;
            });
    }
}
