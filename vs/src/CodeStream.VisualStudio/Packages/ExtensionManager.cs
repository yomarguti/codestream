using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using System;
using System.Collections.Generic;
using Serilog;
using CodeStream.VisualStudio.Core.Logging;

namespace CodeStream.VisualStudio.Packages
{
    public class ExtensionManagerDummy { }

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
			{ "Live Share", ExtensionKind.LiveShare }
        };

        private static ILogger _log;

        public static Lazy<Dictionary<ExtensionKind, bool>> Initialize(ILogger log)
        {
            _log = log;
            return InstalledExtensions;
        }

        private static readonly Lazy<Dictionary<ExtensionKind, bool>> InstalledExtensions = new Lazy<Dictionary<ExtensionKind, bool>>(
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
                    _log.Debug($"AppDomain created");

                    var path =
                        $@"\dlls\{Application.VisualStudioVersionYear}\Microsoft.VisualStudio.ExtensionManager.dll";
                    var assembly = domain.LoadFromDisk(path);
                    _log.Debug($"AppDomain loaded assembly. Path={path}");

                    var installedExtensionsList = PackageExtensions.Invoke<IEnumerable<dynamic>>(
                        assembly.GetType("Microsoft.VisualStudio.ExtensionManager.SVsExtensionManager"),
                        "GetInstalledExtensions");

					if (installedExtensionsList == null)
					{
						_log.Debug($"{installedExtensionsList} is null");
						return installedExtensions;
					}
					
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
							_log.Debug($"Found installed extension=`{name}`");							
                        }
                    }

					if (_log.IsDebugEnabled())
					{
						_log.Debug("Extensions found:");
						_log.Debug(installedExtensions.ToJson(camelCase: true, format: true));
					}
				}
                catch (Exception ex)
                {
                    _log.Error(ex, "Extension");
                }
                finally
                {
                    try
                    {
                        if (domain != null)
                        {
                            AppDomain.Unload(domain);
                            _log.Verbose($"AppDomain unloaded");
                        }
                    }
                    catch (Exception ex)
                    {
                        _log.Error(ex, "Extension");
                    }
                }

                return installedExtensions;
            });
    }
}
