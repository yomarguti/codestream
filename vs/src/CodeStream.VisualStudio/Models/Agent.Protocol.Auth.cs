using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Models
{
   	public class PasswordLoginRequest {
		public string Email { get; set; }
		public string Password { get; set; }
		public string TeamId { get; set; }
		public string Team { get; set; }
	}

    public class PasswordLoginRequestType : RequestType<PasswordLoginRequest> {

	    public const string MethodName = "codestream/login/password";
	    public override string Method => MethodName;
    }
}
