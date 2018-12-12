using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio
{
    public class FooContentDefinition
    {
        [Export]
        [Name("CSharp")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition CSharpContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".cs")]
        [ContentType("CSharp")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition CSharpFileExtensionDefinition;
#pragma warning restore 0649
    }
}
