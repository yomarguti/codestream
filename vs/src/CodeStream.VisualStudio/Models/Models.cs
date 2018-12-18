using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Models
{
    public class FileUri : Uri
    {
        public FileUri(string path) : base("file:///" + path.Replace("/", "\\"))
        {

        }
    }

    public class SelectedText
    {
        public int StartLine { get; set; }
        public int StartColumn { get; set; }
        public int EndLine { get; set; }
        public int EndColumn { get; set; }
        public string Text { get; set; }
    }

    public class Range
    {
        public Range()
        {

        }

        public Range(SelectedText text)
        {
            StartLine = text.StartLine;
            StartCharacter = text.StartColumn;
            EndLine = text.EndLine;
            EndCharacter = text.EndColumn;
        }

        public int[] ToLocation()
        {
            return new int[] { StartLine, StartCharacter, EndLine, EndCharacter };
        }

        public int StartLine { get; set; }
        public int StartCharacter { get; set; }
        public int EndLine { get; set; }
        public int EndCharacter { get; set; }
    }
}
