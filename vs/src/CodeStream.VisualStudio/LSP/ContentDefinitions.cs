using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.LSP
{
    public class ContentDefinitions
    {
        //        [Export]
        //        [Name("CSharp")]
        //        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
        //#pragma warning disable 0649
        //        internal static ContentTypeDefinition CSharpContentTypeDefinition;
        //#pragma warning restore 0649

        //        [Export]
        //        [FileExtension(".cs")]
        //        [ContentType("CSharp")]
        //#pragma warning disable 0649
        //        internal static FileExtensionToContentTypeDefinition CSharpFileExtensionDefinition;
        //#pragma warning restore 0649



        // starting FSharpInteractive
        [Export]
        [Name("FSharpInteractive")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition FSharpInteractiveContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".fsx")]
        [ContentType("FSharpInteractive")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition FSharpInteractiveFileExtensionDefinition;
#pragma warning restore 0649
        // ending FSharpInteractive


        // starting RazorCoreCSharp
        [Export]
        [Name("RazorCoreCSharp")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition RazorCoreCSharpContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".cshtml")]
        [ContentType("RazorCoreCSharp")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition RazorCoreCSharpFileExtensionDefinition;
#pragma warning restore 0649
        // ending RazorCoreCSharp


        // starting RazorVisualBasic
        [Export]
        [Name("RazorVisualBasic")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition RazorVisualBasicContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".vbhtml")]
        [ContentType("RazorVisualBasic")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition RazorVisualBasicFileExtensionDefinition;
#pragma warning restore 0649
        // ending RazorVisualBasic


        // starting CoffeeScript
        [Export]
        [Name("CoffeeScript")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition CoffeeScriptContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".coffee")]
        [ContentType("CoffeeScript")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition CoffeeScriptFileExtensionDefinition;
#pragma warning restore 0649
        // ending CoffeeScript


        // starting CSharp
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
        // ending CSharp


        // starting mustache
        [Export]
        [Name("mustache")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition mustacheContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".mustache")]
        [ContentType("mustache")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition mustacheFileExtensionDefinition;
#pragma warning restore 0649
        // ending mustache


        // starting RazorCSharp
        [Export]
        [Name("RazorCSharp")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition RazorCSharpContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".cshtml")]
        [ContentType("RazorCSharp")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition RazorCSharpFileExtensionDefinition;
#pragma warning restore 0649
        // ending RazorCSharp


        // starting JavaScript
        [Export]
        [Name("JavaScript")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition JavaScriptContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".js")]
        [ContentType("JavaScript")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition JavaScriptFileExtensionDefinition;
#pragma warning restore 0649
        // ending JavaScript


        // starting Python
        [Export]
        [Name("Python")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition PythonContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".py")]
        [ContentType("Python")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition PythonFileExtensionDefinition;
#pragma warning restore 0649
        // ending Python


        // starting F#
        [Export]
        [Name("F#")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition FSharpContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".fs")]
        [ContentType("F#")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition FSharpFileExtensionDefinition;
#pragma warning restore 0649
        // ending F#


        // starting css
        [Export]
        [Name("css")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition cssContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".css")]
        [ContentType("css")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition cssFileExtensionDefinition;
#pragma warning restore 0649
        // ending css


        // starting XML
        [Export]
        [Name("XML")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition XMLContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".xml")]
        [ContentType("XML")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition XMLFileExtensionDefinition;
#pragma warning restore 0649
        // ending XML


        // starting C/C++
        [Export]
        [Name("C/C++")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition CorCPlusPlusContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".cpp")]
        [ContentType("C/C++")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition CorCPlusPlusFileExtensionDefinition;
#pragma warning restore 0649
        // ending C/C++


        // starting vbscript
        [Export]
        [Name("vbscript")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition vbscriptContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".vbs")]
        [ContentType("vbscript")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition vbscriptFileExtensionDefinition;
#pragma warning restore 0649
        // ending vbscript


        // starting TypeScript
        [Export]
        [Name("TypeScript")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition TypeScriptContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".ts")]
        [ContentType("TypeScript")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition TypeScriptFileExtensionDefinition;
#pragma warning restore 0649
        // ending TypeScript


        // starting Dockerfile
        [Export]
        [Name("Dockerfile")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition DockerfileContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".docker")]
        [ContentType("Dockerfile")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition DockerfileFileExtensionDefinition;
#pragma warning restore 0649
        // ending Dockerfile


        // starting LESS
        [Export]
        [Name("LESS")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition LESSContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".less")]
        [ContentType("LESS")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition LESSFileExtensionDefinition;
#pragma warning restore 0649
        // ending LESS


        // starting jade
        [Export]
        [Name("jade")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition jadeContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".jade")]
        [ContentType("jade")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition jadeFileExtensionDefinition;
#pragma warning restore 0649
        // ending jade


        // starting JSON
        [Export]
        [Name("JSON")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition JSONContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".json")]
        [ContentType("JSON")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition JSONFileExtensionDefinition;
#pragma warning restore 0649
        // ending JSON


        // starting HTML
        [Export]
        [Name("HTML")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition HTMLContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".html")]
        [ContentType("HTML")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition HTMLFileExtensionDefinition;
#pragma warning restore 0649
        // ending HTML


        // starting SCSS
        [Export]
        [Name("SCSS")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition SCSSContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".scss")]
        [ContentType("SCSS")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition SCSSFileExtensionDefinition;
#pragma warning restore 0649
        // ending SCSS


        // starting XAML
        [Export]
        [Name("XAML")]
        [BaseDefinition(CodeRemoteContentDefinition.CodeRemoteContentTypeName)]
#pragma warning disable 0649
        internal static ContentTypeDefinition XAMLContentTypeDefinition;
#pragma warning restore 0649
        [Export]
        [FileExtension(".xaml")]
        [ContentType("XAML")]
#pragma warning disable 0649
        internal static FileExtensionToContentTypeDefinition XAMLFileExtensionDefinition;
#pragma warning restore 0649
        // ending XAML





    }
}
