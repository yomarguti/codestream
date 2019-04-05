using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.UI.Margins
{
    public class DocumentMarkViewModel
    {
        public DocumentMarkViewModel(DocumentMarker marker)
        {
            Marker = marker;
        }
        public DocumentMarker Marker { get; }
    }
}
