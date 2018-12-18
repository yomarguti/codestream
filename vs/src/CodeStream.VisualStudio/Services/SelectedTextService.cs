using CodeStream.VisualStudio.Attributes;
using CodeStream.VisualStudio.Models;
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
        SelectedText GetSelectedText();
    }

    //struct TextViewSelection
    //{
    //    public TextViewPosition StartPosition { get; set; }
    //    public TextViewPosition EndPosition { get; set; }
    //    public string Text { get; set; }

    //    public TextViewSelection(TextViewPosition a, TextViewPosition b, string text)
    //    {
    //        StartPosition = TextViewPosition.Min(a, b);
    //        EndPosition = TextViewPosition.Max(a, b);
    //        Text = text;
    //    }
    //}


    //public struct TextViewPosition
    //{
    //    private readonly int _column;
    //    private readonly int _line;

    //    public TextViewPosition(int line, int column)
    //    {
    //        _line = line;
    //        _column = column;
    //    }

    //    public int Line { get { return _line; } }
    //    public int Column { get { return _column; } }


    //    public static bool operator <(TextViewPosition a, TextViewPosition b)
    //    {
    //        if (a.Line < b.Line)
    //        {
    //            return true;
    //        }
    //        else if (a.Line == b.Line)
    //        {
    //            return a.Column < b.Column;
    //        }
    //        else
    //        {
    //            return false;
    //        }
    //    }

    //    public static bool operator >(TextViewPosition a, TextViewPosition b)
    //    {
    //        if (a.Line > b.Line)
    //        {
    //            return true;
    //        }
    //        else if (a.Line == b.Line)
    //        {
    //            return a.Column > b.Column;
    //        }
    //        else
    //        {
    //            return false;
    //        }
    //    }

    //    public static TextViewPosition Min(TextViewPosition a, TextViewPosition b)
    //    {
    //        return a > b ? b : a;
    //    }

    //    public static TextViewPosition Max(TextViewPosition a, TextViewPosition b)
    //    {
    //        return a > b ? a : b;
    //    }
    //}

    [Injected]
    public class SelectedTextService : SSelectedTextService, ISelectedTextService
    {
        private IVsTextManager2 _iIVsTextManager;
        public SelectedTextService(IVsTextManager2 iIVsTextManager)
        {
            _iIVsTextManager = iIVsTextManager;
        }

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

        public SelectedText GetSelectedText()
        {
            var textManager = _iIVsTextManager as IVsTextManager2;
            IVsTextView view;
            int result = textManager.GetActiveView2(1, null, (uint)_VIEWFRAMETYPE.vftCodeWindow, out view);

            view.GetSelection(out int startLine, out int startColumn, out int endLine, out int endColumn);//end could be before beginning

            //var start = new TextViewPosition(startLine, startColumn);
            //var end = new TextViewPosition(endLine, endColumn);

            view.GetSelectedText(out string selectedText);

            return new SelectedText() {
                    StartLine = startLine,
                    StartColumn = startColumn,
                    EndLine = endLine,
                    EndColumn = endColumn,
                    Text = selectedText
            };
        }
    } 
}
