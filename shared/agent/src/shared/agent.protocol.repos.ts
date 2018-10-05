"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { CSRepository } from "./api.protocol";

export interface CreateRepoRequest {
	url: string;
	knownCommitHashes: string[];
}

export interface CreateRepoResponse {
	repo: CSRepository;
}

export const CreateRepoRequestType = new RequestType<
	CreateRepoRequest,
	CreateRepoResponse,
	void,
	void
>("codeStream/repos/create");

export interface FetchReposRequest {
	repoIds?: string[];
}

export interface FetchReposResponse {
	repos: CSRepository[];
}

export const FetchReposRequestType = new RequestType<
	FetchReposRequest,
	FetchReposResponse,
	void,
	void
>("codeStream/repos");

export interface FindRepoRequest {
	url: string;
	firstCommitHashes: string[];
}

export interface FindRepoResponse {
	repo?: CSRepository;
	usernames?: string[];
}

export const FindRepoRequestType = new RequestType<FindRepoRequest, FindRepoResponse, void, void>(
	"codeStream/repos/find"
);

export interface GetRepoRequest {
	repoId: string;
}

export interface GetRepoResponse {
	repo: CSRepository;
}

export const GetRepoRequestType = new RequestType<GetRepoRequest, GetRepoResponse, void, void>(
	"codeStream/repo"
);
