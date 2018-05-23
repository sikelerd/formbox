import { Verfuegungspunkt } from './verfuegungspunkt';

export class SachleitendeVerfuegung {
  private _verfuegungspunkte: Verfuegungspunkt[] = [];

  constructor(vp?: Verfuegungspunkt[]) {
    if (vp) {
      this._verfuegungspunkte = vp.slice();
    }
  }

  clone(): SachleitendeVerfuegung {
    return new SachleitendeVerfuegung(this._verfuegungspunkte);
  }

  get verfuegungspunkte(): Verfuegungspunkt[] {
    return this._verfuegungspunkte.sort((a, b) => a.ordinal - b.ordinal);
  }

  addVerfuegungspunkt(id: number, ueberschrift: string): Verfuegungspunkt {
    return this.insertBeforeVerfuegunspunkt(id, undefined, ueberschrift);
  }

  insertBeforeVerfuegunspunkt(id: number, idNext: number, ueberschrift: string): Verfuegungspunkt {
    const vp = new Verfuegungspunkt(id, ueberschrift);

    if (idNext) {
      const n = this._verfuegungspunkte.findIndex(v => v.id === idNext);
      if (n > 0) {
        this._verfuegungspunkte.splice(n, 0, vp);
      } else {
        this._verfuegungspunkte.unshift(vp);
      }
    } else {
      this._verfuegungspunkte.push(vp);
    }

    this.renumber();

    return vp;
  }

  deleteVerfuegungspunkt(id: number): void {
    const n = this._verfuegungspunkte.findIndex(v => v.id === id);
    if (n > -1) {
      this._verfuegungspunkte.splice(n, 1);
      this.renumber();
    }
  }

  getVerfuegungspunkt(id: number): Verfuegungspunkt {
    return this._verfuegungspunkte.find(vp => vp.id === id);
  }

  private renumber(): void {
    let ordinal = 1;
    this._verfuegungspunkte.forEach(v => {
      v.ordinal = ordinal++;
    });
  }
}
