import { CSRepository } from "../../shared/api.protocol";
import { action } from "../common";
import { ReposActionsType } from "./types";

export const bootstrapRepos = (repos: CSRepository[]) => action(ReposActionsType.Bootstrap, repos);

export const addRepos = (repos: CSRepository[]) => action(ReposActionsType.Add, repos);
