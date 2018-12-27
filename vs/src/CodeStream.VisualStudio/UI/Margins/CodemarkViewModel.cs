using CodeStream.VisualStudio.Models;

namespace CodeStream.VisualStudio.UI.Margins
{
    public class CodemarkViewModel
    {
        public CodemarkViewModel(CsFullMarker marker)
        {
            Marker = marker;
        }
        public CsFullMarker Marker { get; }
    }
}
