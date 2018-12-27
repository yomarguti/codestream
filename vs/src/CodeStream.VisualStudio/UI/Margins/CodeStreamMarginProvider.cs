using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(IWpfTextViewMarginProvider))]
    [Name(CodemarkViewMargin.MarginName)]
    [Order(After = PredefinedMarginNames.Glyph)]
    [MarginContainer(PredefinedMarginNames.Left)]
    [ContentType("text")]
    [TextViewRole(PredefinedTextViewRoles.Interactive)]
    internal sealed class CodeStreamMarginProvider : IWpfTextViewMarginProvider
    {
        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin parent)
        {
            var sessionService = Package.GetGlobalService(typeof(SSessionService)) as ISessionService;
            var agentService = Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
            var eventAggregator = Package.GetGlobalService(typeof(SEventAggregator)) as IEventAggregator;
            var settings = Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService;

            return new CodemarkViewMargin(eventAggregator, sessionService, agentService, settings, wpfTextViewHost.TextView, TextDocumentFactoryService);
        }
    }     
}
