using CodeStream.VisualStudio.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.UI.Margins
{
    public class CodemarkViewModel
    {
        public CodemarkViewModel(CSFullMarker marker)
        {
            Marker = marker;
        }
        public CSFullMarker Marker { get; }
    }
}
