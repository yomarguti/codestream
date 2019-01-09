using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.TextManager.Interop;
using Serilog;
using System;

namespace CodeStream.VisualStudio.Services
{
    public interface IIdeService
    {
        void Navigate(string url);
        ShowCodeResult OpenEditor(string sourceFile, int? scrollTo = null);
        SelectedText GetSelectedText();
        SelectedText GetSelectedText(out IVsTextView view);
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

        private readonly IVsTextManager2 _iIVsTextManager;

        public IdeService(IVsTextManager2 iIVsTextManager)
        {
            _iIVsTextManager = iIVsTextManager;
        }

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

        // old implementation
        //public string GetSelectedText()
        //{
        //    string selectedText;
        //    IVsTextView activeView;
        //    if (_iIVsTextManager != null &&
        //        ErrorHandler.Succeeded(_iIVsTextManager.GetActiveView(1, null, out activeView)) &&
        //        ErrorHandler.Succeeded(activeView.GetSelectedText(out selectedText)))
        //    {
        //        return selectedText;
        //    }
        //    return null;
        //}

        public SelectedText GetSelectedText(out IVsTextView view)
        {
            // ReSharper disable once UnusedVariable
            var result = _iIVsTextManager.GetActiveView2(1, null, (uint)_VIEWFRAMETYPE.vftCodeWindow, out view);

            view.GetSelection(out int startLine, out int startColumn, out int endLine, out int endColumn);
            view.GetSelectedText(out string selectedText);

            // end could be before beginning...
            return new SelectedText()
            {
                StartLine = Math.Min(startLine, endLine),
                StartColumn = Math.Min(startColumn, endColumn),
                EndLine = Math.Max(startLine, endLine),
                EndColumn = Math.Max(startColumn, endColumn),
                Text = selectedText
            };
        }

        public SelectedText GetSelectedText()
        {
            // ReSharper disable once NotAccessedVariable
            IVsTextView view;
            return GetSelectedText(out view);
        }


        public void Navigate(string url)
        {
            System.Diagnostics.Process.Start(url);
        }
    }
}
