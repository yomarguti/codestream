namespace CodeStream.VisualStudio.Core.Models {
	public class CreateDocumentMarkerPermalinkRequest {
		public Range Range { get; set; }
		public string Uri { get; set; }
		public string Privacy { get; set; }
	}

	public class CreateDocumentMarkerPermalinkResponse {
		public string LinkUrl { get; set; }
	}

	public class CreateDocumentMarkerPermalinkRequestType : RequestType<CreateDocumentMarkerPermalinkRequest> {
		public const string MethodName = "codestream/textDocument/markers/create/link";
		public override string Method => MethodName;
	}

	public class GetDocumentFromKeyBindingRequest {
		public int Key { get; set; }
	}
	
	public class GetDocumentFromKeyBindingResponse {
		public TextDocumentIdentifier TextDocument { get; set; }
		public Range Range { get; set; }
		public CsMarker Marker { get; set; }
	}

	public class GetDocumentFromKeyBindingRequestType : RequestType<GetDocumentFromKeyBindingRequest> {
		public const string MethodName = "codestream/textDocument/fromKey";
		public override string Method => MethodName;
	}
}
