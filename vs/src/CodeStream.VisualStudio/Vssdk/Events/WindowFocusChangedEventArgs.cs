using System;

namespace CodeStream.VisualStudio.Vssdk.Events
{
    public sealed class WindowFocusChangedEventArgs : EventArgs
    {
        public string FileName { get; }
        public Uri Uri { get; }

        public WindowFocusChangedEventArgs(string fileName, Uri uri)
        {
            FileName = fileName;
            Uri = uri;
        }
    }
}