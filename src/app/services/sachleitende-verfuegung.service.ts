import { Injectable } from '@angular/core';
import { Logger } from '@nsalaun/ng-logger';
import { Observable } from 'rxjs/Observable';
import * as romanize from 'romanize';

import 'rxjs/add/operator/shareReplay';

import { OfficeService } from './office.service';
import { SachleitendeVerfuegung } from '../data/slv/sachleitende-verfuegung';
import { Verfuegungspunkt } from '../data/slv/verfuegungspunkt';
import { SachleitendeverfuegungActions } from '../store/actions/sachleitendeverfuegung-actions';

@Injectable()
export class SachleitendeVerfuegungService {
  private static readonly FORMATVORLAGE = 'FormboxVerfuegungspunkt';

  constructor(
    private log: Logger,
    private office: OfficeService
  ) { /* Leer */ }

  /**
   * Gibt eine Liste der ContentControls zurück, die als Verfügungspunkte
   * markiert sind. 
   */
  async getVerfuegungspunkteInDocument(): Promise<{ id: number, text: string, verfuegungspunkt1: boolean }[]> {
    return this.office.getAllContentControls().then(cc => {
      return cc.filter(it => it.tag === 'SLV' || it.tag === 'SLVVerfuegungspunkt1')
        .map(it => ({ id: it.id, text: it.text, verfuegungspunkt1: it.tag === 'SLVVerfuegungspunkt1' }));
    });
  }

  /**
   * Erzeugt oder entfernt einen Verfügungspunkt an der aktuellen Cursorposition.
   * 
   * @param abdruck True, wenn es sich um eine Abdruckzeile handelt.
   */
  async toggleVerfuegungspunkt(abdruck = false):
    Promise<{ id: number, idNext?: number, text: string, binding?: string, delete: boolean, abdruck?: boolean }> {
    this.log.debug('SachleitendeVerfuegungService.toggleVerfuegungspunkt()');

    return this.findCurrentVerfuegungspunkt().then(cc => {
      if (cc && cc.tag === 'SLV') {
        return Promise.resolve({ id: cc.id, text: cc.text, delete: true });
      } else {
        return this.insertVerfuegungspunkt(abdruck).then(vp =>
          ({ id: vp.id, idNext: vp.idNext, text: vp.text, binding: vp.binding, delete: false, abdruck: abdruck }));
      }
    });
  }

  /**
   * Setzt oder löscht den Text im Spezialfeld Verfügungspunkt1.
   * 
   * @param id Id des Felds Verfügungspunkt1
   * 
   * @returns True, falls der Text gelöscht wurde.
   */
  async toggleVerfuegungspunkt1(id: number): Promise<{ id: number, delete: boolean }> {
    this.log.debug('SachleitendeVerfuegungService.toggleVerfuegungspunkt1()');

    return this.office.getContentControlText(id).then(text => {
      if (text && text.length > 0) {
        return this.office.replaceTextInContentControl(id, '').then(() => Promise.resolve({ id: id, delete: true }));
      } else {
        return this.office.replaceTextInContentControl(id, 'I.').then(() => Promise.resolve({ id: id, delete: false }));
      }
    });
  }

  /**
   * Prüft, ob an der aktuellen Cursorposition ein Verfügungspunkt 1 angelegt
   * würde.
   */
  async isVerfuegungspunkt1(): Promise<boolean> {
    return this.getPreviousVerfuegungspunkt().then(id => {
      return Promise.resolve(id === undefined);
    });
  }

  /**
   * Fügt eine Zuleitungszeile in einen Verfügungspunkt ein. Wenn der Cursor
   * nicht in einem Verfügungspunkt steht, wird das Promise rejected.
   */
  async insertZuleitungszeile(): Promise<{ id: number, vpId: number }> {
    return this.getPreviousVerfuegungspunkt().then(vpId => {
      if (vpId !== undefined) {
        return this.office.insertContentControl('', 'SLVZuleitung', 'Zuleitungszeile').then(id => {
          return Promise.resolve({ id: id, vpId: vpId });
        });
      } else {
        return Promise.reject('Cursor ist nicht in einem Verfügungspunkt');
      }
    });
  }

  /**
   * Fügt ein Spezialfeld für den ersten Verfügungspunkt ein. Das Spezialfeld
   * enthält nur die römische Ziffer des Verfügungspunkts.
   */
  async insertVerfuegungspunkt1(): Promise<number> {
    return this.office.insertContentControl('', 'SLVVerfuegungspunkt1', '', undefined, undefined, true);
  }

  /**
   * Sucht nach einem ContentControl mit dem Tag 'SLV' im Absatz, in dem der
   * Cursor steht.
   */
  async findCurrentVerfuegungspunkt(): Promise<{ id: number, title: string, tag: string, text: string }> {
    this.log.debug('SachleitendeVerfuegungService.findCurrentVerfuegungspunkt()');

    return this.office.expandRangeToParagraph().then(range => {
      return Promise.resolve(range);
    }).then(range => {
      return this.office.getContentControlsInRange(range).then(cc => {
        this.office.untrack(range);

        return Promise.resolve(cc.find(it => it.tag === 'SLV'));
      });
    });
  }

  /**
   * Gibt den Text der Überschrift eines Verfügungspunkts zurück.
   * 
   * @param id Id des Content Controls des Verfügungspunkts
   */
  async getVerfuegungspunktText(id: number): Promise<string> {
    this.log.debug('SachleitendeVerfuegungService.getVerfuegungspunktText()');

    return this.office.getContentControlText(id);
  }

  /**
   * Ändert die Überschrift eines Verfüngungspunkts.
   * 
   * @param id Id des Content Controls des Verfügungspunkts
   * @param text Text der überschrift ohne Römische Ziffer.
   * @param ordinal Römische Ziffer, die vor den Text gschrieben wird. Wenn
   *    keine Ziffer angegeben wird, wird nur der Text geschireben.
   */
  async updateVerfuegungspunktText(id: number, text: string, ordinal?: string): Promise<void> {

    let s;
    if (ordinal) {
      s = `${ordinal}.\t${text}`;
    } else {
      s = text;
    }

    return this.office.replaceTextInContentControl(id, s.trim());
  }

  /**
   * Liefert eine Liste der Ids aller Verfügungspunkte zurück.
   */
  async getVerfuegungspunkte(): Promise<number[]> {
    return this.office.getAllContentControls().then(c => {
      return Promise.resolve(c.filter(it => it.tag === 'SLV').map(it => it.id));
    });
  }

  async getPreviousVerfuegungspunkt(): Promise<number> {
    this.log.debug('SachleitendeVerfuegungService.getPreviousVerfuegungspunkt()');

    return this.office.getPreviousContentControl('SLV');
  }

  /**
   * Gibt die ID des nächsten Verfügungspunktes zurück. Wenn keine ID übergeben wird,
   * wird von der aktuellen Cursorposition aus gesucht. 
   */
  async getNextVerfuegungspunkt(id?: number): Promise<number> {
    this.log.debug('SachleitendeVerfuegungService.getNextVerfuegungspunkt()');

    return this.office.getNextContentControls(id).then(c => {
      const vp = c.find(it => it.tag === 'SLV');
      if (vp) {
        return Promise.resolve(vp.id);
      } else {
        return Promise.resolve(undefined);
      }
    });
  }

  /**
   * Nummeriert die Verfügungspunkte neu durch und schreibt römische Ziffern
   * an den Beginn der Überschrift. 
   */
  async renumber(slv: SachleitendeVerfuegung): Promise<void> {
    const p = [];

    for (const vp of slv.verfuegungspunkte) {
      p.push(new Promise(() => {
        const numeral = vp.getRomanNumeral();
        const ueberschrift = `${SachleitendeVerfuegung.generatePrefix(vp.ordinal, vp.abdruck)} ${vp.ueberschrift}`;

        this.updateVerfuegungspunktText(vp.id, ueberschrift.trim(), numeral);
      }));
    }

    return Promise.all(p).then(() => Promise.resolve());
  }

  /**
   * Löscht einen Verfügungspunkt aus dem Dokument und entfernt das Databinding. 
   */
  async removeVerfuegungspunkt(id: number, binding: string): Promise<void> {
    return this.office.deleteBinding(binding).then(() => {
      return this.office.deleteContentControl(id);
    });
  }

  /**
   * Vesteckt einen Verfügungspunkt einschließlich des Texts bis zum nächsten
   * Vertfügungspunkt. 
   */
  async hideVerfuegungspunkt(id: number): Promise<void> {
    return this.getNextVerfuegungspunkt(id).then(idNext => {
      return this.office.getRangeBetweenContentControls(id, idNext);
    }).then(rng => {
      return this.office.hideRange(rng).then(() => this.office.untrack(rng));
    });
  }

  /**
   * Macht einen versteckten Verfügungspunkt wieder sichtbar. 
   */
  async unhideVerfuegungspunkt(id: number): Promise<void> {
    return this.getNextVerfuegungspunkt(id).then(idNext => {
      return this.office.getRangeBetweenContentControls(id, idNext);
    }).then(rng => {
      return this.office.unhideRange(rng).then(() => this.office.untrack(rng));
    });
  }

  /**
   * Erzeugt das Databinding zwischen Verfügungspunkten und ContentControls.
   * Die Überschriften der Verfuegungspunkte werden automagisch upgedatet, wenn
   * der User den Text in den ContentControls anpasst. 
   */
  createObservableFromVerfuegungspunkt(vp: Verfuegungspunkt): Observable<string> {
    if (!vp.binding) {
      return undefined;
    }

    const ret = Observable.create(ob => {
      const cb = (text: string) => {
        ob.next(text);
      };

      this.office.addEventHandlerToBinding(vp.binding, cb);

      return (() => this.office.removeEventHandlersFromBinding(vp.binding));
    }).shareReplay(1);

    // Das subscriben ist nötig, damit der EventHandler sofort erzeugt wird.
    // shareReplay sorgt dafür, dass der letzte Wert für zukünftige Subscriber
    // gecacht wird.
    ret.subscribe();

    return ret;
  }

  /**
   * Erzeugt ein Databinding-Objekt für ein ContentControl. 
   */
  async bindVerfuegungspunkt(id: number): Promise<string> {
    this.log.debug('SachleitendeVerfuegungService.bindVerfuegungspunkt()');

    return this.office.bindToContentControl(id, 'SLV');
  }

  /**
   * Erzeugt ein Druckdokument mit allen Ausfertigungen einer Sachleitenden 
   * Verfügung. Die Ausfertigungen werden aneinandergehängt.
   * 
   * @param slv Sachleitende Verfügung
   * @param Anzahl der Kopien pro Verfügungspunkt
   */
  async print(slv: SachleitendeVerfuegung, copies: number[]): Promise<void> {
    return this.newDocument().then(async doc => {
      let index = 0;
      for (const vp of slv.verfuegungspunkte) {
        if (copies[index] > 0) {
          const hidden = slv.verfuegungspunkte.filter(it => it.ordinal > vp.ordinal);
          await Promise.all(hidden.map(it => this.hideVerfuegungspunkt(it.id))).then(() => {
            return this.copyCurrentDocument(doc, true, (index === 0), copies[index]).then(async () => {
              if (vp.zuleitungszeilen.length !== 0) {
                for (const z of vp.zuleitungszeilen) {
                  await this.copyCurrentDocument(doc, true, false, 1);
                }
              }
            });
          }).then(() => {
            return Promise.all(hidden.map(it => this.unhideVerfuegungspunkt(it.id)));
          });
        }
        index++;
      }

      return Promise.resolve(doc);
    }).then(doc => {
      this.showDocument(doc);
    });
  }

  private async insertVerfuegungspunkt(abdruck: boolean): Promise<{ id: number, text: string, idNext: number, binding: string }> {
    this.log.debug('SachleitendeVerfuegungService.insertVerfuegungspunkt()');

    return this.office.insertContentControlAroundParagraph(
      '', 'SLV', 'Verfügungspunkt', SachleitendeVerfuegungService.FORMATVORLAGE, abdruck).then(id => {
        return this.bindVerfuegungspunkt(id).then(bid => ({ id: id, binding: bid }))
          .then(vp => this.office.getContentControlText(id).then(text => ({ id: id, binding: vp.binding, text: text })))
          .then(vp => this.getNextVerfuegungspunkt(id).then(idNext => ({ id: vp.id, text: vp.text, idNext: idNext, binding: vp.binding })));
      });
  }

  private async newDocument(): Promise<Word.DocumentCreated> {
    this.log.debug('SachleitendeVerfuegungService.newDocument()');

    return this.office.newDocument().then(doc => {
      return Promise.resolve(doc);
    });
  }

  private async copyCurrentDocument(target: Word.DocumentCreated, pageBreak = false, skipFirstBreak = false, times = 1): Promise<void> {
    this.log.debug('SachleitendeVerfuegungService.copyCurrentDocument()');

    return Promise.resolve().then(async () => {
      for (let i = 0; i < times; i++) {
        if (pageBreak && !(skipFirstBreak && i === 0)) {
          await this.office.insertPageBreak(target);
        }
        await this.office.copyDocument(target);
      }

      return Promise.resolve();
    });
  }

  private async showDocument(doc: Word.DocumentCreated): Promise<void> {
    this.log.debug('SachleitendeVerfuegungService.showDocument()');

    return this.office.showDocument(doc).then(() => this.office.untrack(doc));
  }

}
