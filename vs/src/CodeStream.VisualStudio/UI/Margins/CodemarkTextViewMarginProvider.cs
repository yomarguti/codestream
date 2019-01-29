using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Events;
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
    internal sealed class CodemarkTextViewMarginProvider : IWpfTextViewMarginProvider
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

            if (!TextDocumentFactoryService.TryGetTextDocument(wpfTextViewHost.TextView.TextBuffer, out var textDocument))
            {
                return null;
            }

            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
            var toolWindowProvider = Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
            var agentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
            var settings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;

            return new CodemarkTextViewMargin(
                _viewTagAggregatorFactoryService,
                _glyphFactoryProviders,
                wpfTextViewHost,
                eventAggregator,
                toolWindowProvider,
                sessionService,
                agentService,
                settings,
                wpfTextViewHost.TextView,
                textDocument);
        }
    }
}
