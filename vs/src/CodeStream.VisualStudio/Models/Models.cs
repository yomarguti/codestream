using CodeStream.VisualStudio.Extensions;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.Models
{
    public class FileUri : Uri
    {
        public FileUri(string path) : base("file:///" + path.Replace("/", "\\"))
        {

        }

        public bool EqualsIgnoreCase(string uri)
        {
            return uri.EqualsIgnoreCase(this.ToString());
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

        public int[] ToLocation()
        {
            return new int[] { StartLine, StartCharacter, EndLine, EndCharacter };
        }

        public int StartLine { get; set; }
        public int StartCharacter { get; set; }
        public int EndLine { get; set; }
        public int EndCharacter { get; set; }
    }

    public class SourceRemote
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    public class SourceAuthor
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    public class Source
    {
        public string File { get; set; }
        public string RepoPath { get; set; }
        public string Revision { get; set; }
        public List<SourceAuthor> Authors { get; set; }
        public List<SourceRemote> Remotes { get; set; }
    }
}
