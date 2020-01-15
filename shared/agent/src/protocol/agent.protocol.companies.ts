import { RequestType } from "vscode-languageserver-protocol";
import { CSCompany } from "./api.protocol";

export interface FetchCompaniesRequest {
	mine?: boolean;
	companyIds?: string[];
}

export interface FetchCompaniesResponse {
	companies: CSCompany[];
}

export const FetchCompaniesRequestType = new RequestType<
	FetchCompaniesRequest,
	FetchCompaniesResponse,
	void,
	void
>("codestream/companies");

export interface GetCompanyRequest {
	companyId: string;
}

export interface GetCompanyResponse {
	company: CSCompany;
}

export const GetCompanyRequestType = new RequestType<
	GetCompanyRequest,
	GetCompanyResponse,
	void,
	void
>("codestream/company");
