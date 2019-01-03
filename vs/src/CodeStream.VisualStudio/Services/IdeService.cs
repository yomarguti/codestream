using CodeStream.VisualStudio.Core.Logging;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;
using CodeStream.VisualStudio.Annotations;

namespace CodeStream.VisualStudio.Services
{
    public interface IIdeService
    {
        void Navigate(string url);
        ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null);
    }

    public interface SIdeService { }

    public enum ShowCodeResult
    {
        // ReSharper disable InconsistentNaming
        SUCCESS,
        FILE_NOT_FOUND,
        REPO_NOT_IN_WORKSPACE
        // ReSharper restore InconsistentNaming
    }

    [Injected]
    public class IdeService : IIdeService, SIdeService
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();

        public ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var dte = Package.GetGlobalService(typeof(DTE)) as DTE;

            if (dte == null)
            {
                return ShowCodeResult.SUCCESS;
            }

            try
            {
                ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                    dte.ExecuteCommand("File.OpenFile", sourceFile);

                    await ThreadHelper.JoinableTaskFactory.RunAsync(async delegate
                    {
                        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                        try
                        {
                            // TODO UGH WTF can't this work right?! >:0
                            //if (scrollTo != null && scrollTo.Value > 0)
                            //{
                            //    dte.ExecuteCommand("Edit.Goto", scrollTo.Value.ToString());
                            //}
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, $"Could not go to line {scrollTo} in {sourceFile}");
                        }
                    });
                });

                return ShowCodeResult.SUCCESS;
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"OpenEditor failed for {sourceFile}");
                return ShowCodeResult.FILE_NOT_FOUND;
            }
        }

    
        public void Navigate(string url)
        {
            System.Diagnostics.Process.Start(url);
        }
    }
}
