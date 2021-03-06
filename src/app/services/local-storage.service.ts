import { Injectable } from '@angular/core';
import { Logger } from '@nsalaun/ng-logger';
import { DexieStorage } from '../storage/dexie-storage';
import { Absender } from '../storage/absender';
import { StorageService } from './storage.service';

/**
 * Service zum Speichern von lokalen Benutzerdaten im LocalStorage des
 * Browsers.
 */
@Injectable()
export class LocalStorageService extends StorageService {

  /**
   * Initialisiert die Dexie-Datenbank.
   */
  constructor(
    private db: DexieStorage,
    private log: Logger
  ) {
    super();
  }

  async open(): Promise<void> {
    return this.db.open().then(d => { Promise.resolve(); });
  }

  async reset(): Promise<void> {
    return this.db.delete().then(async () => {
      await this.db.open().then(async () => {
        await this.db.init();
      });
    });
  }

  async getPAL(): Promise<Absender[]> {
    return this.db.getPAL();
  }

  async getSelected(): Promise<number> {
    return this.db.getSelected();
  }

  async setPAL(absender: Absender[]): Promise<void> {
    return this.db.setPAL(absender);
  }

  async setSelected(selected: number): Promise<void> {
    return this.db.setSelected(selected);
  }
}
