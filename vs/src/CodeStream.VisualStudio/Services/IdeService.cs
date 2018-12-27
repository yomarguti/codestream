using EnvDTE;
using Microsoft.VisualStudio.Shell;
using System;
using CodeStream.VisualStudio.Core.Logging;
using Serilog;

namespace CodeStream.VisualStudio.Services
{
    public interface IIdeService
    {
        ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null);
    }

    public interface SIdeService
    {

    }

    public enum ShowCodeResult
    {
        SUCCESS,
        FILE_NOT_FOUND,
        REPO_NOT_IN_WORKSPACE
    }


    public class IdeService : IIdeService, SIdeService
    {
        static readonly ILogger Log = LogManager.ForContext<WebViewRouter>();


        public ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var dte = Package.GetGlobalService(typeof(DTE)) as DTE;

            try
            {
                var window = dte.ItemOperations.OpenFile(sourceFile);
                if (window != null)
                {
                    window.Visible = true;
                    if (scrollTo != null && scrollTo.Value > 0)
                    {
                        dte.ExecuteCommand("Edit.Goto", scrollTo.Value.ToString());
                    }
                }
                return ShowCodeResult.SUCCESS;

            }
            catch(Exception ex)
            {
                Log.Error(ex, $"OpenEditor {sourceFile}");
                return ShowCodeResult.FILE_NOT_FOUND;
            }
        }
    }
}
