using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.UI.Margins
{
    internal class CodemarkGlyphCache
    {
        internal CodemarkGlyphCache(Codemark codemark, int startLine)
        {
            Codemark = codemark;
            Height = codemark.Height;
            StartLine = startLine;
        }
        public Codemark Codemark { get; }
        public int StartLine { get; }
        public double Height { get; }
    }
}
