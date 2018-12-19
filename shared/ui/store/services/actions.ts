import { action } from "../common";
import { ServicesActionsType } from "./types";

export { reset } from "../../actions";

export const bootstrapServices = (services: {}) => action(ServicesActionsType.Bootstrap, services);
