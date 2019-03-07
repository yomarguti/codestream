using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using EnvDTE;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows;
using EditorState = CodeStream.VisualStudio.Models.EditorState;
using ILogger = Serilog.ILogger;

namespace CodeStream.VisualStudio.Services
{
    public class ActiveTextEditor
    {
        public IWpfTextView TextView { get; set; }
        public string FilePath { get; set; }
        public Uri Uri { get; set; }
    }

    public enum ExtensionKind
    {
        LiveShare
    }

    public interface IIdeService
    {
        void Navigate(string url);
        ShowCodeResult OpenEditor(string fileUri, int? scrollTo = null);
        ShowCodeResult OpenEditor(Uri fileUri, int? scrollTo = null);
        EditorState GetActiveEditorState();
        EditorState GetActiveEditorState(out IVsTextView view);
        ActiveTextEditor GetActiveTextView();
        //bool QueryExtensions(string author, params string[] names);
        bool QueryExtension(ExtensionKind extensionKind);
        bool TryStartLiveShare();
        bool TryJoinLiveShare(string url);
        System.Threading.Tasks.Task GetClipboardTextValueAsync(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null);
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
        private static readonly ILogger Log = LogManager.ForContext<IdeService>();

        private readonly IComponentModel _componentModel;
        private readonly IVsTextManager _iIVsTextManager;
        private readonly Dictionary<ExtensionKind, bool> _extensions;

        public IdeService(IComponentModel componentModel, IVsTextManager iIVsTextManager, Dictionary<ExtensionKind, bool> extensions)
        {
            _componentModel = componentModel;
            _iIVsTextManager = iIVsTextManager;
            _extensions = extensions;
        }

        public ActiveTextEditor GetActiveTextView()
        {
            var editor = _componentModel.GetService<IVsEditorAdaptersFactoryService>();

            _iIVsTextManager.GetActiveView(1, null, out IVsTextView textViewCurrent);
            var wpfTextView = editor.GetWpfTextView(textViewCurrent);
            if (wpfTextView == null)
            {
                return null;
            }

            var exports = _componentModel.DefaultExportProvider;
            if (!exports.GetExportedValue<ITextDocumentFactoryService>().TryGetTextDocument(wpfTextView.TextBuffer, out var textDocument))
            {
                return new ActiveTextEditor
                {
                    TextView = wpfTextView
                };
            }
            return new ActiveTextEditor
            {
                TextView = wpfTextView,
                Uri = textDocument.FilePath.ToUri(),
                FilePath = textDocument.FilePath
            };
        }

        /// <summary>
        /// Open editor using an absolute file path
        /// </summary>
        /// <param name="fileUri"></param>
        /// <param name="scrollTo">the 1-based line number</param>
        /// <returns>ShowCodeResult</returns>
        public ShowCodeResult OpenEditor(string fileUri, int? scrollTo = null)
        {
            return OpenEditor(fileUri.ToUri(), scrollTo);
        }

        /// <summary>
        /// Open editor using an absolute file path
        /// </summary>
        /// <param name="fileUri"></param>
        /// <param name="scrollTo">the 1-based line number</param>
        /// <returns>ShowCodeResult</returns>
        public ShowCodeResult OpenEditor(Uri fileUri, int? scrollTo = null)
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
                    dte.ExecuteCommand("File.OpenFile", fileUri.ToLocalPath());

                    await ThreadHelper.JoinableTaskFactory.RunAsync(async delegate
                    {
                        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                        try
                        {
                            if (scrollTo != null && scrollTo.Value > 0)
                            {
                                //https://docs.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2013/dd885855(v=vs.120)

                                dte.ExecuteCommand("Edit.Goto", scrollTo.Value.ToString());
                            }
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, $"Could not go to line {scrollTo} in {fileUri}");
                        }
                    });
                });

                return ShowCodeResult.SUCCESS;
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"OpenEditor failed for {fileUri}");
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

        public EditorState GetActiveEditorState(out IVsTextView view)
        {
            try
            {
                // ReSharper disable once UnusedVariable
                var result = _iIVsTextManager.GetActiveView(1, null, out view);

                // view can be null...
                if (view == null) return null;

                view.GetCaretPos(out int piLine, out int piColumn);
                view.GetSelection(out int startLine, out int startColumn, out int endLine, out int endColumn);
                view.GetSelectedText(out string selectedText);

                // end could be before beginning...
                return new EditorState(
                    new Range
                    {
                        Start = new Position(startLine, startColumn),
                        End = new Position(endLine, endColumn)
                    }, new Position(piLine, piColumn), selectedText);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, nameof(GetActiveEditorState));
            }
            view = null;
            return null;
        }

        public EditorState GetActiveEditorState()
        {
            return GetActiveEditorState(out IVsTextView textView);
        }

        // someday, this can return...
        //public bool QueryExtensions(string author, params string[] names)
        //{
        //    if (_extensionManager == null)
        //    {
        //        Log.Debug($"{nameof(_extensionManager)} is null");
        //        return false;
        //    }

        //    foreach (var extension in _extensionManager.GetInstalledExtensions())
        //    {
        //        IExtensionHeader header = extension.Header;
        //        if (!header.SystemComponent &&
        //            header.Author.EqualsIgnoreCase(author) && names.Any(_ => _.EqualsIgnoreCase(header.Name)))
        //        {
        //            return true;
        //        }
        //    }
        //    return false;
        //}

        public bool QueryExtension(ExtensionKind extensionKind)
        {
            return _extensions.TryGetValue(extensionKind, out bool value) && value;
        }

        public bool TryStartLiveShare()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            try
            {
                ExecuteCommand("LiveShare.ShareWorkspace");
                return true;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Could not start Live Share");
            }

            return false;
        }

        public bool TryJoinLiveShare(string url)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (url.IsNullOrWhiteSpace())
            {
                Log.Warning("Live Share Url is missing");
                return false;
            }

            try
            {
                ExecuteCommand("LiveShare.JoinWorkspace", $"/Root {url}");
                return true;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Could not join Live Share Url={Url}", url);
            }

            return false;
        }


        /// <summary>
        /// Uses built in process handler for navigating to an external url
        /// </summary>
        /// <param name="url">an absolute url</param>
        public void Navigate(string url)
        {
            if (url.IsNullOrWhiteSpace())
            {
                Log.Warning("Url is missing");
                return;
            }

            System.Diagnostics.Process.Start(url);
        }

        public async System.Threading.Tasks.Task GetClipboardTextValueAsync(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null)
        {
            if (callback == null) await System.Threading.Tasks.Task.CompletedTask;

            var workerTask = System.Threading.Tasks.Task.Run(() =>
            {
                var magicNumber = (int)Math.Round(Math.Sqrt(millisecondsTimeout));
                Exception threadEx = null;
                string result = null;
                System.Threading.Thread staThread = null;
                staThread = new System.Threading.Thread(
                      delegate (object state)
                      {
                          for (var i = 0; i < magicNumber + 1; i++)
                          {
                              try
                              {
                                  var textString = Clipboard.GetDataObject()?.GetData(DataFormats.Text) as string;
                                  if (millisecondsTimeout > 0)
                                  {
                                      if (clipboardMatcher != null)
                                      {
                                          if (textString != null && clipboardMatcher.IsMatch(textString))
                                          {
                                              result = textString;
                                              break;
                                          }
                                      }
                                      else
                                      {
                                          result = textString;
                                          break;
                                      }
                                  }
                                  else
                                  {
                                      result = textString;
                                      break;
                                  }

                                  System.Threading.Thread.Sleep(magicNumber);
                              }
                              catch (Exception ex)
                              {
                                  threadEx = ex;
                              }
                          }
                      });

                staThread.SetApartmentState(ApartmentState.STA);
                staThread.Start();
                staThread.Join();
                callback?.Invoke(result);
            });

            try
            {
                await workerTask;
            }
            catch (OperationCanceledException)
            {
                await System.Threading.Tasks.Task.CompletedTask;
            }
        }

        private void ExecuteCommand(string commandName, string commandArgs = "") //must me " not null...
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            Log.Verbose("ExecuteCommand={CommandName} CommandArgs={commandArgs}", commandName, commandArgs);
            var dte = Package.GetGlobalService(typeof(DTE)) as DTE;
            if (dte == null) throw new ArgumentNullException(nameof(dte));
            dte.ExecuteCommand(commandName, commandArgs);
            Log.Verbose("ExecuteCommand={CommandName} CommandArgs={commandArgs} Success", commandName, commandArgs);
        }

        /// <summary>
        /// https://stackoverflow.com/questions/518701/clipboard-gettext-returns-null-empty-string
        /// </summary>
        /// <remarks>Only works when apartmentState is STA</remarks>
        /// <returns></returns>
        public string GetClipboardText()
        {
            IDataObject idat = null;
            // ReSharper disable once NotAccessedVariable
            Exception threadEx = null;
            object text = "";
            System.Threading.Thread staThread = new System.Threading.Thread(
                delegate ()
                {
                    try
                    {
                        idat = Clipboard.GetDataObject();
                        text = idat?.GetData(DataFormats.Text);
                    }
                    catch (Exception ex)
                    {
                        threadEx = ex;
                    }
                });
            staThread.SetApartmentState(ApartmentState.STA);
            staThread.Start();
            staThread.Join();

            return text as string;
        }
    }
}
