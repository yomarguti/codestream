using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Models
{
    [TestClass]
    public class CamelCaseStringEnumConverterTests
    {
        [TestMethod]
        public void CamelCaseStringEnumConverterTest()
        {
            var foo = new Foo { Type = CodemarkType.Bookmark };
            var json = foo.ToJson();

            var result = json.FromJson<Foo>();
            Assert.IsTrue(json.Contains("bookmark"));
            Assert.AreEqual(CodemarkType.Bookmark, result.Type);
        }

        class Foo
        {
            public CodemarkType Type { get; set; }
        }
    }
}