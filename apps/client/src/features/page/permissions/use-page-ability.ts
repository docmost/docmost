import { createMongoAbility } from "@casl/ability";
import { PageAbility } from "./permissions.type";

export const usePageAbility = (rules: any) => {
  if (!rules) {
    rules = [];
  }

  const ability = createMongoAbility<PageAbility>(rules);

  return {
    can: ability.can.bind(ability),
    cannot: ability.cannot.bind(ability),
  };
};
