using CodeStream.VisualStudio.Attributes;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.TextManager.Interop;
using System;

namespace CodeStream.VisualStudio.Services
{
    public interface SSelectedTextService
    {
    }

    /// <summary>
    /// Provides a way to get any currently selected text in the text editor area.
    /// </summary>
    public interface ISelectedTextService
    {
        /// <summary>
        /// Gets the currently selected text.
        /// </summary>
        /// <returns>The selected text in the active editor, or an empty string if no text is selected.</returns>
        bool TryGetSelectedText(out string text);
    }

    [Injected]
    public class SelectedTextService : SSelectedTextService, ISelectedTextService
    {
        private IServiceProvider _serviceProvider;
        public SelectedTextService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public bool TryGetSelectedText(out string text)
        {
            string selectedText;
            IVsTextView activeView;
            var textManager = _serviceProvider.GetService(typeof(SVsTextManager)) as IVsTextManager;

            if (textManager != null &&
                ErrorHandler.Succeeded(textManager.GetActiveView(1, null, out activeView)) &&
                ErrorHandler.Succeeded(activeView.GetSelectedText(out selectedText)))
            {
                text = selectedText;
                return true;
            }

            text = null;
            return false;
        }
    }
}
