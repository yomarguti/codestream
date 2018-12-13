using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Imaging.Interop;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Operations;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace CodeStream.VisualStudio
{
    [Export(typeof(ISuggestedActionsSourceProvider))]
    [Name("CodeStream Codemark")]
    [ContentType("any")]
    internal class TestSuggestedActionsSourceProvider : ISuggestedActionsSourceProvider
    {
        [Import(typeof(ITextStructureNavigatorSelectorService))]
        internal ITextStructureNavigatorSelectorService NavigatorService { get; set; }

        public ISuggestedActionsSource CreateSuggestedActionsSource(ITextView textView, ITextBuffer textBuffer)
        {
            if (textBuffer == null || textView == null)
            {
                return null;
            }
            return new TestSuggestedActionsSource(this, textView, textBuffer);
        }
    }

    internal class TestSuggestedActionsSource : ISuggestedActionsSource
    {
        private readonly TestSuggestedActionsSourceProvider m_factory;
        private readonly ITextBuffer m_textBuffer;
        private readonly ITextView m_textView;

        public TestSuggestedActionsSource(TestSuggestedActionsSourceProvider testSuggestedActionsSourceProvider, ITextView textView, ITextBuffer textBuffer)
        {
            m_factory = testSuggestedActionsSourceProvider;
            m_textBuffer = textBuffer;
            m_textView = textView;
        }

        public void Dispose()
        {
        }

        public bool TryGetTelemetryId(out Guid telemetryId)
        {
            // This is a sample provider and doesn't participate in LightBulb telemetry  
            telemetryId = Guid.Empty;
            return false;
        }

#pragma warning disable 0067
        public event EventHandler<EventArgs> SuggestedActionsChanged;
#pragma warning restore 0067

        public IEnumerable<SuggestedActionSet> GetSuggestedActions(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            var selectedTextService = Package.GetGlobalService(typeof(SSelectedTextService)) as ISelectedTextService;
            string selectedText;

            if (selectedTextService.TryGetSelectedText(out selectedText))
            {
                return new SuggestedActionSet[]
               {
                    new SuggestedActionSet(new ISuggestedAction[]
                        {
                            new CodemarkSuggestedAction(selectedText)
                        }
                    )
               };
            }

            return Enumerable.Empty<SuggestedActionSet>();
        }

        public Task<bool> HasSuggestedActionsAsync(ISuggestedActionCategorySet requestedActionCategories, SnapshotSpan range, CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult(true);
        }
    }

    internal class CodemarkSuggestedAction : ISuggestedAction
    {
        private string _text;
        private string _display;

        public CodemarkSuggestedAction(string text)
        {
            _text = text;
            _display = "CodeStream: Add Codemark...";
        }

        public Task<IEnumerable<SuggestedActionSet>> GetActionSetsAsync(CancellationToken cancellationToken)
        {
            return System.Threading.Tasks.Task.FromResult<IEnumerable<SuggestedActionSet>>(null);
        }

        public void Invoke(CancellationToken cancellationToken)
        {
            MessageBox.Show(_text);
            // m_span.TextBuffer.Replace(m_span.GetSpan(m_snapshot), m_upper);

            //Task<object> task = System.Threading.Tasks.Task.Run<object>(
            //    async () => await CodestreamAgentService.Instance.SendAsync("codeStream/post/prepareWithCode",
            //    JToken.Parse((new
            //    {
            //        textDocument = new { uri = @"file:///C:/Users/brian/code/ConsoleApp1/ConsoleApp1/Program.cs" },
            //        range = new { start = 1, end = 10 },
            //        dirty = false
            //    }).ToJson()), cancellationToken));
            //var foo = task.Result;

        }

        public Task<object> GetPreviewAsync(CancellationToken cancellationToken)
        {
            var textBlock = new TextBlock();
            textBlock.Padding = new Thickness(5);
            textBlock.Inlines.Add(new Run() { Text = _text });

            return System.Threading.Tasks.Task.FromResult<object>(textBlock);
        }

        public void Dispose()
        {
        }

        public bool TryGetTelemetryId(out Guid telemetryId)
        {
            // This is a sample action and doesn't participate in LightBulb telemetry  
            telemetryId = Guid.Empty;
            return false;
        }

        public bool HasActionSets
        {
            get { return false; }
        }

        public string DisplayText
        {
            get { return _display; }
        }

        public ImageMoniker IconMoniker
        {
            get { return default(ImageMoniker); }
        }

        public string IconAutomationText
        {
            get
            {
                return null;
            }
        }

        public string InputGestureText
        {
            get
            {
                return null;
            }
        }

        public bool HasPreview
        {
            get { return false; }
        }
    }
}
