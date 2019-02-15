using System.Collections.Generic;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Classification;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(IWpfTextViewMarginProvider))]
    [MarginContainer(PredefinedMarginNames.VerticalScrollBar)]
    [Name(PredefinedCodestreamNames.CodemarkTextViewScrollbarMargin)]
    [Order(After = PredefinedMarginNames.OverviewChangeTracking, Before = PredefinedMarginNames.OverviewMark)]
    [ContentType(ContentTypes.Text)]
    [TextViewRole(PredefinedTextViewRoles.Interactive)]
    [TextViewRole(PredefinedTextViewRoles.Document)]
    // [DeferCreation(OptionName = MatchMarginEnabledOption.OptionName)]
    internal sealed class VerticalScrollbarMarkerProvider : ICodeStreamWpfTextViewMarginProvider
    {
#pragma warning disable 649
        [Import]
        internal IEditorFormatMapService EditorFormatMapService;

        [Export]
        [Name("MatchMarginAdornmentLayer")]
        [Order(After = PredefinedAdornmentLayers.Outlining, Before = PredefinedAdornmentLayers.Selection)]
        internal AdornmentLayerDefinition MatchLayerDefinition;
#pragma warning restore 649

        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        private static readonly List<string> TextViewRoles = new List<string>
        {
            PredefinedTextViewRoles.Interactive,
            PredefinedTextViewRoles.Document
        };

        public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin containerMargin)
        {
            var containerMarginAsVerticalScrollBar = containerMargin as IVerticalScrollBar;
            if (containerMarginAsVerticalScrollBar == null)
            {
                return null;
            }

            // only get views that we care about
            if (!wpfTextViewHost.TextView.Roles.ContainsAll(TextViewRoles)) return null;

            if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextViewHost.TextView.TextBuffer, out var textDocument))
            {
                return null;
            }

            TextViewMargin = new VerticalScrollbarMarker(
                wpfTextViewHost,
                textDocument,
                containerMarginAsVerticalScrollBar,
                EditorFormatMapService,
                Package.GetGlobalService(typeof(SSessionService)) as ISessionService
            );

            return TextViewMargin;
        }

        public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
    }
}
