using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using EnvDTE;
using Microsoft.VisualStudio.ExtensionManager;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.TextManager.Interop;
using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows;
using ILogger = Serilog.ILogger;

namespace CodeStream.VisualStudio.Services
{
    public enum ExtensionKind
    {
        LiveShare
    }

    public interface IIdeService
    {
        void Navigate(string url);
        ShowCodeResult OpenEditor(Uri fileUri, int? scrollTo = null);
        SelectedText GetSelectedText();
        SelectedText GetSelectedText(out IVsTextView view);
        bool QueryExtensions(string author, params string[] names);
        bool QueryExtension(ExtensionKind extensionKind);
        bool TryStartLiveShare();
        bool TryJoinLiveShare(string url);

        System.Threading.Tasks.Task GetClipboardTextValue(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null);
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
        private readonly IVsExtensionManager _extensionManager;

        public IdeService(IVsTextManager2 iIVsTextManager, IVsExtensionManager extensionManager)
        {
            _iIVsTextManager = iIVsTextManager;
            _extensionManager = extensionManager;
        }

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
                            // TODO UGH WTF can't this work right?! >:0
                            //if (scrollTo != null && scrollTo.Value > 0)
                            //{
                            //    dte.ExecuteCommand("Edit.Goto", scrollTo.Value.ToString());
                            //}
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

        public SelectedText GetSelectedText(out IVsTextView view)
        {
            // ReSharper disable once UnusedVariable
            var result = _iIVsTextManager.GetActiveView2(1, null, (uint)_VIEWFRAMETYPE.vftCodeWindow, out view);

            // view can be null...
            if (view == null) return null;

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

        public bool QueryExtensions(string author, params string[] names)
        {
            foreach (var extension in _extensionManager.GetInstalledExtensions())
            {
                IExtensionHeader header = extension.Header;
                if (!header.SystemComponent &&
                    header.Author.EqualsIgnoreCase(author) && names.Any(_ => _.EqualsIgnoreCase(header.Name)))
                {
                    return true;
                }
            }

            return false;
        }

        public bool QueryExtension(ExtensionKind extensionKind)
        {
            if (extensionKind == ExtensionKind.LiveShare)
            {
                return QueryExtensions("microsoft", "VS Live Share - Preview", "VS Live Share");
            }

            throw new ArgumentException("extensionKind");
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

        public SelectedText GetSelectedText()
        {
            // ReSharper disable once NotAccessedVariable
            IVsTextView view;
            return GetSelectedText(out view);
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

        public async System.Threading.Tasks.Task GetClipboardTextValue(int millisecondsTimeout, Action<string> callback, Regex clipboardMatcher = null)
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
            catch (OperationCanceledException ex)
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
