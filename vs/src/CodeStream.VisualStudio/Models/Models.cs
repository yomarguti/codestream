using CodeStream.VisualStudio.Extensions;
using System;

namespace CodeStream.VisualStudio.Models
{
    public class FileUri : Uri
    {
        public FileUri(string path) : base("file:///" + path.Replace("/", "\\"))
        {

        }

        public bool EqualsIgnoreCase(string uri)
        {
            return uri.EqualsIgnoreCase(ToString());
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

    // Note this is a vscode-languageserver model
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

        /// <summary>
        /// formats a range as [StartLine, StartCharacter, EndLine, EndCharacter]
        /// </summary>
        /// <returns></returns>
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
