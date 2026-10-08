export const entitySeedIds = {
  people: {
    joao: "0f650efa-c6c4-4d84-97c9-62e9f97a1d01",
    natch: "d13e9e0d-beb7-4f97-a86f-a2d83e1bc220",
  },
  accounts: {
    joao: "2eb4767d-39eb-45d3-b280-281baab67a01",
    natch: "a2e1eb66-e43c-4e5e-bb5b-7f510a110c15",
    joint: "6c1dc1ca-6b0a-4ab2-8b24-25dc2d0b23be",
  },
  categories: {
    house: "c472c0d6-4ae0-4835-bf58-34cc9801420a",
    car: "20dd6cf8-9bb6-468b-86ac-bf47d3d96eae",
    dog: "e4f97dc8-ddb9-41f7-9c8a-187a2c419f51",
    extras: "f6d5b176-304b-4256-97fa-ce6a45e9191f",
  },
  personIncomes: {
    joao202601: "4ba21d39-2bd3-43f4-a8b6-8077e7a9fa10",
    joao202605: "7af0fba6-58e5-4d63-bdf1-54aa27e39481",
    natch202601: "c5b82b85-cb3d-46c4-bb81-e11d7f66c9f4",
  },
} as const;

export const legacyPersonIds: Record<string, string> = {
  joao: entitySeedIds.people.joao,
  natch: entitySeedIds.people.natch,
};

export const legacyAccountIds: Record<string, string> = {
  joao: entitySeedIds.accounts.joao,
  natch: entitySeedIds.accounts.natch,
  joint: entitySeedIds.accounts.joint,
};

export const legacyCategoryIds: Record<string, string> = {
  house: entitySeedIds.categories.house,
  car: entitySeedIds.categories.car,
  dog: entitySeedIds.categories.dog,
  extras: entitySeedIds.categories.extras,
};
