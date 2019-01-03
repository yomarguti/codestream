using CodeStream.VisualStudio.Extensions;
using System;
using System.Diagnostics;

namespace CodeStream.VisualStudio.Models
{
    public class SelectedText
    {
        public int StartLine { get; set; }
        public int StartColumn { get; set; }
        public int EndLine { get; set; }
        public int EndColumn { get; set; }
        public string Text { get; set; }

        public bool HasText => Text.IsNotNullOrWhiteSpace();
    }

    /// <summary>
    /// This is a vscode-languageserver model
    /// </summary>
    [DebuggerDisplay("Start Line={StartLine} Char={StartCharacter}, End Line={EndLine} Char={EndCharacter}")]
    public class Range
    {
        public Range(int startLine, int startCharacter, int endLine, int endCharacter)
        {
            StartLine = startLine;
            StartCharacter = startCharacter;
            EndLine = endLine;
            EndCharacter = endCharacter;
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

        public int StartLine { get; }
        public int StartCharacter { get;  }
        public int EndLine { get;  }
        public int EndCharacter { get;  }
    }
}
