using CodeStream.VisualStudio.Core.Logging.Sanitizer;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Core.Logging.Sanitizer
{
    [TestClass]
    public class SecretsSanitizingFormatRuleTests
    {
        [TestMethod]
        [DataRow("foo", "bar", "baz")]
        [DataRow("foo", "\"bar", "\"baz")]
        [DataRow("foo", "\"bar\"", "\"baz\"")]
        public void SanitizeTest(string userName, string password, string token)
        {
            Assert.AreEqual((new
            {
                userName, password = "<hidden>", token = "<hidden>",
            }).ToJson(), new SecretsSanitizingFormatRule().Sanitize(new
            {
                userName, password, token,
            }.ToJson()));
        }
    }
}