using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.UI.Margins
{
    public class CodemarkViewModel
    {
        public CodemarkViewModel(DocumentMarker marker)
        {
            Marker = marker;
        }
        public DocumentMarker Marker { get; }
    }
}
