// HT08: previous and next record of a detail page (products now; elaboraciones and supplies next),
// in the default order of its list. Same shape for every resource: `GET …/{id}/vecinos`.
export interface Vecino {
  id: number;
  nombre: string;
}

export interface Vecinos {
  anterior: Vecino | null;
  siguiente: Vecino | null;
}
