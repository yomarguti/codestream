using CodeStream.VisualStudio.Attributes;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.TextManager.Interop;

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
        /// <returns>The selected text in the active editor, or a null string if no text is selected.</returns>
        string GetSelectedText();
    }

    [Injected]
    public class SelectedTextService : SSelectedTextService, ISelectedTextService
    {
        private IVsTextManager _iIVsTextManager;
        public SelectedTextService(IVsTextManager iIVsTextManager)
        {
            _iIVsTextManager = iIVsTextManager;
        }

        public string GetSelectedText()
        {
            string selectedText;
            IVsTextView activeView;
            
            if (_iIVsTextManager != null &&
                ErrorHandler.Succeeded(_iIVsTextManager.GetActiveView(1, null, out activeView)) &&
                ErrorHandler.Succeeded(activeView.GetSelectedText(out selectedText)))
            {            
               return selectedText;                
            }

            return null;            
        }
    }
}
