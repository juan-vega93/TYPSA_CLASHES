import type { Clash } from "./clash-types";
import { encounterGroup } from "./clash-importance";
import { buildSearchText } from "./clash-query";
/** Historical reporting retains identities, states, classification and filters, not raw property bags. */
export function compactClash(clash: Clash): Clash {
  const { raw: _rawA, filterValues: _itemFiltersA, ...a } = clash.items[0];
  const { raw: _rawB, filterValues: _itemFiltersB, ...b } = clash.items[1];
  void _rawA;
  void _rawB;
  void _itemFiltersA;
  void _itemFiltersB;
  const categoryA = encounterGroup(clash.items[0]),
    categoryB = encounterGroup(clash.items[1]);
  const searchText =
    clash.searchText ??
    (categoryA !== a.category || categoryB !== b.category ? buildSearchText(clash) : undefined);
  return {
    ...clash,
    searchText,
    items: [
      { ...a, category: categoryA },
      { ...b, category: categoryB },
    ],
  };
}
