import { action } from "../common";
import { ServicesActionsType } from "./types";

export const bootstrapServices = (services: {}) => action(ServicesActionsType.Bootstrap, services);
