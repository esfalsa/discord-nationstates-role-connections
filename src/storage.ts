type StorageData = {
  expires: Date;
};

type StateData = StorageData & {
  /**
   * The name of the nation, in lowercase and without underscores
   */
  nation: string;
  /**
   * The name of the nation, with original capitalization and spaces
   */
  name: string;
  waMember: boolean;
  population: number;
  founded: string | number;
};

export class Storage {
  store = new Map();

  prune() {
    const now = new Date();
    for (const [key, value] of this.store) {
      if (value.expires < now) {
        this.store.delete(key);
      }
    }
  }

  setStateData(state: string, data: StateData) {
    return this.store.set(`state-${state}`, data);
  }

  getStateData(state: string): StateData {
    return this.store.get(`state-${state}`);
  }

  deleteStateData(state: string) {
    return this.store.delete(`state-${state}`);
  }
}
