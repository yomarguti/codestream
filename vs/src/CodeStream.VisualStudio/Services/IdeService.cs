using CodeStream.VisualStudio.Core.Logging;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Serilog;
using System;

namespace CodeStream.VisualStudio.Services
{
    public interface IIdeService
    {
        ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null);
    }

    public interface SIdeService { }

    public enum ShowCodeResult
    {
        SUCCESS,
        FILE_NOT_FOUND,
        REPO_NOT_IN_WORKSPACE
    }

    public class IdeService : IIdeService, SIdeService
    {
        private static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();

        public ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null)
        {
            Microsoft.VisualStudio.Shell.ThreadHelper.ThrowIfNotOnUIThread();
            var dte = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(DTE)) as DTE;

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
    }
}
