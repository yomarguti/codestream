using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Models
{
    [TestClass]
    public class EditorSelectionTests
    {
        /// <summary>
        /// This exists because of serialization issue with Range/Position
        /// </summary>
        [TestMethod]
        public void EditorSelectionTest()
        {
            var foo = new EditorSelection(new Position(1, 1),
                new Range
                {
                    Start = new Position(2, 2),
                    End = new Position(3, 3)
                });

            var json = foo.ToJson();
            var result = json.FromJson<EditorSelection>();
            Assert.AreEqual(1, result.Cursor.Line);
            Assert.AreEqual(1, result.Cursor.Character);

            Assert.AreEqual(2, result.Start.Line);
            Assert.AreEqual(2, result.Start.Character);

            Assert.AreEqual(3, result.End.Line);
            Assert.AreEqual(3, result.End.Character);
        }
    }
}