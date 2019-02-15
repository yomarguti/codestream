using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(IWpfTextViewMarginProvider))]
    [Name(PredefinedCodestreamNames.CodemarkTextViewMargin)]
    [Order(After = PredefinedMarginNames.Glyph)]
    [MarginContainer(PredefinedMarginNames.Left)]
    [ContentType(ContentTypes.Text)]
    [TextViewRole(PredefinedTextViewRoles.Interactive)]
    [TextViewRole(PredefinedTextViewRoles.Document)]
    internal sealed class CodemarkTextViewMarginProvider : ICodeStreamWpfTextViewMarginProvider
    {
        private readonly IViewTagAggregatorFactoryService _viewTagAggregatorFactoryService;
        private readonly Lazy<IGlyphFactoryProvider, IGlyphMetadata>[] _glyphFactoryProviders;

        [ImportingConstructor]
        public CodemarkTextViewMarginProvider(IViewTagAggregatorFactoryService viewTagAggregatorFactoryService,
            [ImportMany] IEnumerable<Lazy<IGlyphFactoryProvider, IGlyphMetadata>> glyphFactoryProviders)
        {
            _viewTagAggregatorFactoryService = viewTagAggregatorFactoryService;

            // only get _our_ glyph factory
            _glyphFactoryProviders = Orderer.Order(glyphFactoryProviders)
                .Where(_ => _.Metadata.Name == PredefinedCodestreamNames.CodemarkGlyphFactoryProvider).ToArray();
        }

        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        private static readonly List<string> TextViewRoles = new List<string>
        {
            PredefinedTextViewRoles.Interactive,
            PredefinedTextViewRoles.Document
        };

        public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin parent)
        {
            // only get views that we care about
            if (!wpfTextViewHost.TextView.Roles.ContainsAll(TextViewRoles)) return null;

            if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextViewHost.TextView.TextBuffer, out var textDocument))
            {
                return null;
            }

            TextViewMargin = new CodemarkTextViewMargin(
                _viewTagAggregatorFactoryService,
                _glyphFactoryProviders,
                wpfTextViewHost,
                Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider,
                Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
                wpfTextViewHost.TextView,
                textDocument
            );

            return TextViewMargin;
        }

        public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
    }
}
