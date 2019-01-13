using System;
using CodeStream.VisualStudio.UnitTests.Stubs;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Services
{
    [TestClass]
    public class CredentialsServiceTests
    {
        [TestMethod]
        public void AllTest()
        {
            var email = "a@b.com";
            var serverUri = new Uri("http://foo.com");
            var secret = "sEcReT";

            var testCredentialsService = new CredentialsServiceStub();

            var saved = testCredentialsService.SaveAsync(serverUri, email, secret);
            Assert.IsTrue(saved.Result);

            var exists = testCredentialsService.LoadAsync(serverUri, email);
            Assert.IsTrue(exists.Result.Item1 == email);
            Assert.IsTrue(exists.Result.Item2 == secret);

            var deleted = testCredentialsService.DeleteAsync(serverUri, email);
            Assert.IsTrue(deleted.Result);
        }
    }
}