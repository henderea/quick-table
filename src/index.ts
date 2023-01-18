import { LoDashStatic } from 'lodash';

export declare type Listener = (...args: any[]) => any;

export interface JQueryQuickTable {
  <T>(initFunc?: ((table: QuickTable<T>) => void) | null): QuickTable<T> | QuickTables<T>;
  columnId(column: number | ColumnId): ColumnId;
  rowId(row: number | RowId, isHead?: boolean): RowId;
  cellId(row: number | RowId | CellId, column?: number | ColumnId, isHead?: boolean): CellId;
  types: TypeManager;
}

/* @internal */
declare global {
  interface JQuery {
    QuickTable: JQueryQuickTable;
  }
}

/* @internal */
let $: JQueryStatic;
/* @internal */
let _: LoDashStatic;

/* @internal */
declare interface Dictionary<V> {
  [key: string]: V;
  [key: number]: V;
}

/* @internal */
declare interface List<V> {
  readonly length: number;
  readonly [key: number]: V;
}

/* @internal */
declare type Many<T> = T | ReadonlyArray<T>;

/* @internal */
declare type Unwrappable<T> = T | ((...args: any[]) => T);

/* @internal */
function unwrap<T>(val: Unwrappable<T>, ...params: any[]): T {
  if(_.isFunction(val)) {
    return (val as (...args: any) => T)(...params);
  } else {
    return val as T;
  }
}

// region stripHtml
/* @internal */
class ParseContext {
  _context = {
    depth: 0,
    quote: false,
    comment: false,
    tagBuffer: '',
    ending: false,
    buffer: ''
  };

  get depth(): number { return this._context.depth; }

  get quote(): boolean | string { return this._context.quote; }

  get comment(): boolean { return this._context.comment; }

  tagBuffer(slice: number = 0): string { return this._context.tagBuffer.slice(slice); }

  get ending(): boolean { return this._context.ending; }

  get buffer(): string { return this._context.buffer.slice(0); }

  get quoteOrComment(): boolean { return (!!this.quote) || this.comment; }

  get inHtml(): boolean { return this.depth > 0; }

  set<T>(name: string, val: T | ((value: T, context?: this) => T)): this {
    (this._context as any)[name] = unwrap(val, (this._context as any)[name] as T, this);
    return this;
  }

  add(name: string, val: number | string): this {
    return this.set(name, (v: any) => v + val);
  }

  prepare(): void {
    this.set('ending', false);
    this.set('buffer', '');
  }

  toString(): string {
    return this._context.toString();
  }
}

/* @internal */
declare type ParseConditionInternal = {
  cond: (context: ParseContext, c?: string) => boolean,
  act?: (context: ParseContext, c?: string) => void,
  subs?: Many<ParseConditionInternal>
};

/* @internal */
declare type ParseCondition = {
  char: string | RegExp,
  subs: Many<ParseConditionInternal>
};

/* @internal */
function subCond(c: string, cond: ParseCondition | ParseConditionInternal, context: ParseContext) {
  if(cond) {
    if((<ParseConditionInternal>cond).act) {
      ((<ParseConditionInternal>cond).act as (context: ParseContext, c?: string) => void)(context, c);
    }
    if(cond.subs) {
      subCond(c, _.find(_.flatten([cond.subs] as List<Many<ParseConditionInternal>>), (sub) => sub.cond(context, c)) as ParseConditionInternal, context);
    }
  }
}

/* @internal */
function sw(c: string, context: ParseContext, conds: List<ParseCondition>) {
  subCond(c, _.find(conds, (cond) => _.isRegExp(cond.char) ? (<RegExp>cond.char).test(c) : (<string>cond.char).includes(c)) as ParseCondition, context);
}

/* @internal */
function stripHtml(str: string | null | undefined): string {
  if(_.isNil(str)) { return ''; }
  const context: ParseContext = new ParseContext();

  const conds: List<ParseCondition> = [
    {
      char: '<',
      subs: {
        cond: (ctx) => !ctx.quoteOrComment,
        act: (ctx) => ctx.add('depth', 1)
      }
    },
    {
      char: '>',
      subs: [
        {
          cond: (ctx) => !ctx.quoteOrComment && ctx.inHtml,
          act: (ctx) => ctx.add('depth', -1).set('ending', true)
        },
        {
          cond: (ctx) => ctx.comment && ctx.tagBuffer(-2) == '--',
          act: (ctx) => ctx.set('comment', false).set('ending', true)
        }
      ]
    },
    {
      char: `"'`,
      subs: {
        cond: (ctx) => !ctx.comment && ctx.inHtml,
        subs: [
          {
            cond: (ctx) => !ctx.quote,
            act: (ctx, c) => ctx.set('quote', c)
          },
          {
            cond: (ctx, c) => ctx.quote == c,
            act: (ctx) => ctx.set('quote', false).set('ending', true)
          }
        ]
      }
    },
    {
      char: '-',
      subs: {
        cond: (ctx) => !ctx.comment && ctx.inHtml && ctx.tagBuffer(-3) == '<!-',
        act: (ctx) => ctx.add('depth', -1).set('comment', true)
      }
    },
    {
      char: /\s/,
      subs: {
        cond: (ctx) => ctx.tagBuffer() == '<',
        act: (ctx) => ctx.add('depth', -1).set('tagBuffer', '').add('buffer', '<')
      }
    }
  ];
  return _.reduce(str.split(''), (r: string, c: string) => {
    context.prepare();
    sw(c, context, conds);
    r += context.buffer;
    if(context.inHtml || context.comment || context.ending) {
      context.add('tagBuffer', c);
      return r;
    } else {
      context.set('tagBuffer', '');
      return r + c;
    }
  }, '');
}

//endregion

export declare interface TypeDefinition {
  preSort?: (data: any) => any;
  preFilter?: (data: any) => string;
  compare?: (a: any, b: any) => number;
  render?: (data: any) => string;
}

/* @internal */
function stringify(v: any | null | undefined): string | null | undefined {
  if(_.isNil(v)) { return v; }
  if(_.isBoolean(v)) { return v ? 'true' : 'false'; }
  return String(v);
}

/* @internal */
function basicCompare(a: any, b: any): number {
  if(_.isNil(a) && _.isNil(b)) { return 0; }
  if(_.isNil(a)) { return 1; }
  if(_.isNil(b)) { return -1; }
  if(_.lt(a, b)) { return -1; }
  if(_.gt(a, b)) { return 1; }
  return 0;
}

/* @internal */
function defaultCompare(a: any, b: any): number {
  return basicCompare(stringify(a), stringify(b));
}

/* @internal */
const _makeInstance = Symbol('makeInstance');
/* @internal */
const _setFilter = Symbol('setFilter');

export class TypeManager {
  /* @internal */
  private readonly _types: Dictionary<TypeDefinition> = {};
  /* @internal */
  private constructor() {
    //empty
  }

  /* @internal */
  static [_makeInstance](): TypeManager { return new TypeManager(); }

  defineType(name: string, typeDef: TypeDefinition): this {
    this._types[name] = _.extend({}, this._types[name], typeDef);
    return this;
  }

  compare(type: string | null | undefined, a: any, b: any): number {
    if(_.isNil(type)) { return defaultCompare(a, b); }
    const typeDef: TypeDefinition | undefined = this._types[type];
    if(!typeDef) { return defaultCompare(a, b); }
    const preProcess: boolean = _.isFunction(typeDef.preSort);
    if(_.isFunction(typeDef.preSort)) {
      a = typeDef.preSort(a);
      b = typeDef.preSort(b);
    }
    if(_.isFunction(typeDef.compare)) { return typeDef.compare(a, b); }
    if(preProcess) { return basicCompare(a, b); }
    return defaultCompare(a, b);
  }

  render(type: string | null | undefined, data: any): string {
    if(_.isNil(type)) { return stringify(data) || ''; }
    const typeDef: TypeDefinition | undefined = this._types[type];
    if(!typeDef || !_.isFunction(typeDef.render)) { return stringify(data) || ''; }
    return typeDef.render(data) || '';
  }

  matches(type: string | null | undefined, r: RegExp, data: any): boolean {
    if(_.isNil(type)) { return r.test(stringify(data) || ''); }
    const typeDef: TypeDefinition | undefined = this._types[type];
    if(typeDef && _.isFunction(typeDef.preFilter)) { data = typeDef.preFilter(data); }
    return r.test(stringify(data) || '');
  }
}

/* @internal */
const types: TypeManager = TypeManager[_makeInstance]();

/* @internal */
function setupDefaultTypes(): void {
  types
    .defineType('date', {
      preSort(data: any): any {
        if(!_.isString(data)) { return data; }
        const ts: number = Date.parse(data);
        return _.isNaN(ts) ? -Infinity : ts;
      }
    })
    .defineType('string', {})
    .defineType('html', {
      preSort: (data: any) => stripHtml(stringify(data)),
      preFilter: (data: any) => stripHtml(stringify(data))
    })
    .defineType('num', {
      preSort(data: any): any {
        if(_.isNil(data)) { return -Infinity; }
        const v: number = parseFloat(String(data));
        return _.isNaN(v) ? -Infinity : v;
      }
    })
    .defineType('html-num', {
      preSort(data: any): any {
        if(_.isNil(data)) { return -Infinity; }
        const v: number = parseFloat(String(stripHtml(stringify(data))));
        return _.isNaN(v) ? -Infinity : v;
      },
      preFilter: (data: any) => stripHtml(stringify(data))
    });
}

export declare interface ColumnDef<T> {
  cellType?: string;
  data?: string;
  type?: string;
  render?: (data: any, row: T) => string;
  html?: boolean;
  cssClass?: string;
}

export class ColumnId {
  /* @internal */
  private readonly _columnIndex: number;
  /* @internal */
  private constructor(columnIndex: number) {
    this._columnIndex = columnIndex;
  }

  /* @internal */
  static [_makeInstance](columnIndex: number): ColumnId { return new ColumnId(columnIndex); }

  get columnIndex(): number { return this._columnIndex; }

  toString(): string { return `ColumnId[${this.columnIndex}]`; }
}

/* @internal */
const columnIds: Dictionary<ColumnId> = {};

export function columnId(column: number | ColumnId): ColumnId {
  if(column instanceof ColumnId) { return column; }
  if(!(columnIds[column] instanceof ColumnId)) {
    columnIds[column] = ColumnId[_makeInstance](column);
  }
  return columnIds[column];
}

export class CellId {
  /* @internal */
  private readonly _rowId: RowId;
  /* @internal */
  private readonly _columnId: ColumnId;
  /* @internal */
  private constructor(rowId: RowId, columnId: ColumnId) {
    this._rowId = rowId;
    this._columnId = columnId;
  }

  /* @internal */
  static [_makeInstance](rowId: RowId, columnId: ColumnId): CellId { return new CellId(rowId, columnId); }

  get rowId(): RowId { return this._rowId; }
  get columnId(): ColumnId { return this._columnId; }
  get rowIndex(): number { return this.rowId.rowIndex; }
  get isHead(): boolean { return this.rowId.isHead; }
  get columnIndex(): number { return this.columnId.columnIndex; }

  toString(): string { return `CellId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}, ${this.columnIndex}]`; }
}

/* @internal */
const _getCellId = Symbol('getCellId');

export class RowId {
  /* @internal */
  private readonly cellIds: Dictionary<CellId> = {};
  /* @internal */
  private readonly _rowIndex: number;
  /* @internal */
  private readonly _isHead: boolean;
  /* @internal */
  private constructor(rowIndex: number, isHead: boolean) {
    this._rowIndex = rowIndex;
    this._isHead = isHead;
  }

  /* @internal */
  static [_makeInstance](rowIndex: number, isHead: boolean): RowId { return new RowId(rowIndex, isHead); }

  get rowIndex(): number { return this._rowIndex; }
  get isHead(): boolean { return this._isHead; }

  /* @internal */
  [_getCellId](columnId: ColumnId): CellId {
    if(!(this.cellIds[String(columnId)] instanceof CellId)) {
      this.cellIds[String(columnId)] = CellId[_makeInstance](this, columnId);
    }
    return this.cellIds[String(columnId)];
  }

  toString(): string { return `RowId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}]`; }
}

/* @internal */
const rowIds: { head: Dictionary<RowId>, body: Dictionary<RowId> } = {
  head: {},
  body: {}
};

export function rowId(row: number | RowId, isHead: boolean = false): RowId {
  if(row instanceof RowId) {
    if(!isHead || row.isHead) {
      return row;
    }
    row = row.rowIndex;
  }
  if(!(rowIds[isHead ? 'head' : 'body'][row] instanceof RowId)) {
    rowIds[isHead ? 'head' : 'body'][row] = RowId[_makeInstance](row, isHead);
  }
  return rowIds[isHead ? 'head' : 'body'][row];
}

export function cellId(row: number | RowId | CellId, column: number | ColumnId = 0, isHead = false): CellId {
  if(row instanceof CellId) { return row; }
  return rowId(row, isHead)[_getCellId](columnId(column));
}

export class EventEmitter {
  /* @internal */
  private readonly _listeners: Dictionary<Listener[]> = {};
  /* @internal */
  protected constructor() {
    //empty
  }

  /* @internal */
  private get listeners(): Dictionary<Listener[]> { return this._listeners; }

  on(event: string, handler: Listener): this {
    if(!this.listeners[event]) { this.listeners[event] = []; }
    this.listeners[event].push(handler);
    return this;
  }

  trigger(event: string, ...args: any[]): this {
    if(this.listeners[event] && this.listeners[event].length > 0) {
      _.each(this.listeners[event], (handler: Listener) => {
        handler(...args);
      });
    }
    return this;
  }

  forward(event: string, proxy: EventEmitter): this {
    if(proxy instanceof EventEmitter) {
      this.on(event, (...args) => proxy.trigger(event, ...args));
    }
    return this;
  }
}

/* @internal */
const _partition = Symbol('_partition');

export class QTPartition<T extends QTIterable<T, E>, E> {
  /* @internal */
  private readonly _included: T;
  /* @internal */
  private readonly _excluded: T;

  /* @internal */
  private constructor(partition: [T, T]) {
    this._included = partition[0];
    this._excluded = partition[1];
  }

  /* @internal */
  static [_makeInstance]<T extends QTIterable<T, E>, E>(partition: [T, T]): QTPartition<T, E> { return new QTPartition<T, E>(partition); }

  get included(): T { return this._included; }
  get excluded(): T { return this._excluded; }

  withIncluded(func: (included: T) => void): this {
    func(this.included);
    return this;
  }

  withExcluded(func: (excluded: T) => void): this {
    func(this.excluded);
    return this;
  }

  /* @internal */
  private partitionWith(iter: (e: E) => boolean, modInd: 0 | 1, base: T, other: T): QTPartition<T, E> {
    const p: [T, T] = base[_partition](iter);
    p[modInd] = other.joinWith(p[modInd]);
    return new QTPartition<T, E>(p);
  }

  partitionOut(iter: (e: E) => boolean): QTPartition<T, E> { return this.partitionWith(iter, 1, this.included, this.excluded); }
  partitionIn(iter: (e: E) => boolean): QTPartition<T, E> { return this.partitionWith(iter, 0, this.included, this.excluded); }
}

export declare type QTColumnPartition<T> = QTPartition<Columns<T>, Column<T>>;
export declare type QTRowPartition<T> = QTPartition<Rows<T>, Row<T>>;
export declare type QTCellPartition<T> = QTPartition<Cells<T>, Cell<T>>;
export declare type QTTablePartition<T> = QTPartition<QuickTables<T>, QuickTable<T>>;

export class QTIterable<T extends QTIterable<T, E>, E> {
  /* @internal */
  protected _self: () => T;
  /* @internal */
  protected _getter: (self: T) => E[];
  /* @internal */
  protected _maker: (elements: E[]) => T;

  /* @internal */
  protected constructor(self: () => T, getter: (self: T) => E[], maker: (elements: E[]) => T) {
    this._self = self;
    this._getter = getter;
    this._maker = maker;
  }

  /* @internal */
  private get self(): T { return this._self(); }
  /* @internal */
  private getter(self: T): E[] { return this._getter(self); }
  /* @internal */
  private maker(elements: E[]): T { return this._maker(elements); }
  /* @internal */
  private dualMaker(parts: [E[], E[]]): [T, T] { return [this.maker(parts[0]), this.maker(parts[1])]; }

  forEach(iter: (e: E) => void): this {
    _.each(this.toArray(), iter);
    return this;
  }

  each(iter: (e: E) => void): this { return this.forEach((e: E) => { iter(e); }); }
  map<R>(iter: (e: E) => R): R[] { return _.map(this.toArray(), iter); }
  flatMap<R>(iter: (e: E) => R): R[] { return _.flatMap(this.toArray(), iter); }
  some(iter: (e: E) => boolean): boolean { return _.some(this.toArray(), iter); }
  every(iter: (e: E) => boolean): boolean { return _.every(this.toArray(), iter); }
  find(iter: (e: E) => boolean): E | undefined { return _.find(this.toArray(), iter); }
  findLast(iter: (e: E) => boolean): E | undefined { return _.findLast(this.toArray(), iter); }
  filter(iter: (e: E) => boolean): T { return this.maker(_.filter(this.toArray(), iter)); }
  /* @internal */
  [_partition](iter: (e: E) => boolean): [T, T] { return this.dualMaker(_.partition(this.toArray(), iter)); }
  joinWith(...parts: T[]): T { return this.maker(_.flatMap(_.concat([], this.self, parts), (p) => p.toArray())); }
  partition(iter: (e: E) => boolean): QTPartition<T, E> { return QTPartition[_makeInstance](this[_partition](iter)); }
  partitionOutOver<I>(list: I[], iter: (e: E, l: I, i: number) => boolean): QTPartition<T, E> {
    return _.reduce(list, (p: QTPartition<T, E>, l: I, i: number) => p.partitionOut((e: E) => iter(e, l, i)), this.partition(() => true));
  }
  partitionInOver<I>(list: I[], iter: (e: E, l: I, i: number) => boolean): QTPartition<T, E> {
    return _.reduce(list, (p: QTPartition<T, E>, l: I, i: number) => p.partitionIn((e: E) => iter(e, l, i)), this.partition(() => false));
  }
  toArray(): E[] { return this.getter(this.self); }
}

export class Cell<T> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _cellId: CellId;
  /* @internal */
  private constructor(quickTable: QuickTable<T>, cellId: CellId) {
    this._quickTable = quickTable;
    this._cellId = cellId;
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, cellId: CellId): Cell<T> { return new Cell(quickTable, cellId); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get cellId(): CellId { return this._cellId; }
  get rowIndex(): number { return this.cellId.rowIndex; }
  get isHead(): boolean { return this.cellId.isHead; }
  get columnIndex(): number { return this.cellId.columnIndex; }
  get rowId(): RowId { return this.cellId.rowId; }
  get columnId(): ColumnId { return this.cellId.columnId; }
  get row(): Row<T> | null { return this.quickTable.row(this.rowId); }
  get column(): Column<T> | null { return this.quickTable.column(this.columnId); }
  get $(): JQuery { return ((row) => row ? row.$cells.eq(this.columnIndex) : $())(this.row); }
  get htmlData(): string { return this.$.html(); }
  set htmlData(htmlData: string) { this.$.html(htmlData); }
  get textData(): string { return this.$.text(); }
  set textData(textData: string) { this.$.text(textData); }
  get data(): any {
    if(this.quickTable.rawSortedData && this.quickTable.rawSortedData.length > this.rowIndex && this.quickTable.columnDefs && this.quickTable.columnDefs.length > this.columnIndex) {
      const def: ColumnDef<T> = this.quickTable.columnDefs[this.columnIndex];
      if(typeof def.render == 'function') {
        return this.textData;
      }
      const d: T = this.quickTable.rawSortedData[this.rowIndex] as T;
      let fieldData: any = null;
      if(def.data) {
        fieldData = (d as Dictionary<any>)[def.data];
        return fieldData;
      }
    }
    return this.textData;
  }
  get rawData(): any {
    if(this.quickTable.rawSortedData && this.quickTable.rawSortedData.length > this.rowIndex && this.quickTable.columnDefs && this.quickTable.columnDefs.length > this.columnIndex) {
      const d: T = this.quickTable.rawSortedData[this.rowIndex] as T;
      const def: ColumnDef<T> = this.quickTable.columnDefs[this.columnIndex];
      let fieldData: any = null;
      if(def.data) {
        fieldData = (d as Dictionary<any>)[def.data];
      }
      if(typeof def.render == 'function') {
        fieldData = def.render(fieldData, d);
      }
      return fieldData;
    }
    return this.htmlData;
  }
}

export class Cells<T> extends QTIterable<Cells<T>, Cell<T>> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _cellIds: CellId[];
  /* @internal */
  private constructor(quickTable: QuickTable<T>, cellIds: (CellId | Cell<T> | Cells<T>)[]) {
    super(() => this, (c: Cells<T>) => c.cells, (e: Cell<T>[]) => Cells[_makeInstance](this.quickTable, e));
    this._quickTable = quickTable;
    this._cellIds = _.flatMap(_.flatten([cellIds]), (c) => {
      if(c instanceof Cell) { return c.cellId; }
      if(c instanceof Cells) { return c.cellIds; }
      return c;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, cellIds: (CellId | Cell<T> | Cells<T>)[]): Cells<T> { return new Cells(quickTable, cellIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get cellIds(): CellId[] { return this._cellIds; }
  get cells(): Cell<T>[] { return _.filter(_.map(this.cellIds, (c) => this.quickTable.cell(c))) as Cell<T>[]; }
  get $(): JQuery { return _.reduce(this.cells, (col: JQuery, c: Cell<T>) => col.add(c.$), $()) as JQuery; }
  get htmlData(): string[] { return _.map(this.cells, (c) => c.htmlData); }
  get textData(): string[] { return _.map(this.cells, (c) => c.textData); }
  get data(): any[] { return _.map(this.cells, (c) => c.data); }
  get rawData(): any[] { return _.map(this.cells, (c) => c.rawData); }
  get length(): number { return this.cellIds.length; }
}

export class Column<T> extends EventEmitter {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _columnId: ColumnId;
  /* @internal */
  private constructor(quickTable: QuickTable<T>, columnId: ColumnId) {
    super();
    this._quickTable = quickTable;
    this._columnId = columnId;
    this.forward('column.visible', this.quickTable);
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, columnId: ColumnId): Column<T> { return new Column(quickTable, columnId); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get columnId(): ColumnId { return this._columnId; }
  get index(): number { return this.columnId.columnIndex; }
  get $head(): JQuery { return this.quickTable.$.find(`thead tr th:nth-child(${this.index + 1}), thead tr td:nth-child(${this.index + 1})`); }
  get $body(): JQuery { return this.quickTable.$.find(`tbody tr th:nth-child(${this.index + 1}), tbody tr td:nth-child(${this.index + 1})`); }
  get $(): JQuery { return this.$head.add(this.$body); }
  get visible(): boolean { return this.$.is(function(this: any) { return $(this).css('display') != 'none'; }); }
  set visible(visible: boolean) {
    const oldVisible: boolean = this.visible;
    this.$[visible ? 'show' : 'hide']();
    this.trigger('column.visible', {
      columnId: this.columnId,
      oldValue: oldVisible,
      newValue: visible,
      visible
    });
  }

  cell(row: number | RowId, isHead: boolean = false): Cell<T> | null { return ((r) => r && r.cell(this.columnId))(this.quickTable.row(row, isHead)); }
  headerCell(row: number | RowId): Cell<T> | null { return this.cell(row, true); }
  cellId(row: number | RowId, isHead: boolean = false): CellId { return cellId(row, this.columnId, isHead); }
  get headerCellIds(): CellId[] { return _.map(_.range(this.quickTable.headerRowCount), (r) => this.cellId(r, true)); }
  get bodyCellIds(): CellId[] { return _.map(_.range(this.quickTable.rowCount), (r) => this.cellId(r, false)); }
  get cellIds(): CellId[] { return _.concat([], this.headerCellIds, this.bodyCellIds); }
  get headerCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }
  get bodyCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  setFilter(search: string, regex: boolean = false, smart: boolean = true, caseInsensitive: boolean = true): this {
    this.quickTable[_setFilter](this.index, search, regex, smart, caseInsensitive);
    return this;
  }
  resetFilter(): this { return this.setFilter(''); }
  applyFilters(): this {
    this.quickTable.applyFilters();
    return this;
  }
}

export class Columns<T> extends QTIterable<Columns<T>, Column<T>> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _columnIds: ColumnId[];
  /* @internal */
  private constructor(quickTable: QuickTable<T>, columnIds: (ColumnId | Column<T> | Columns<T>)[]) {
    super(() => this, (c: Columns<T>) => c.columns, (e: Column<T>[]) => Columns[_makeInstance](this.quickTable, e));
    this._quickTable = quickTable;
    this._columnIds = _.flatMap(_.flatten([columnIds]), (c) => {
      if(c instanceof Column) { return c.columnId; }
      if(c instanceof Columns) { return c.columnIds; }
      return c;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, columnIds: (ColumnId | Column<T> | Columns<T>)[]): Columns<T> { return new Columns(quickTable, columnIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get columnIds(): ColumnId[] { return this._columnIds; }
  get columns(): Column<T>[] { return _.filter(_.map(this.columnIds, (c) => this.quickTable.column(c))) as Column<T>[]; }
  get $head(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$head), $()); }
  get $body(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$body), $()); }
  get $(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$), $()); }
  get headerCellIds(): CellId[] { return _.flatMap(this.columns, (c) => c.headerCellIds); }
  get bodyCellIds(): CellId[] { return _.flatMap(this.columns, (c) => c.bodyCellIds); }
  get cellIds(): CellId[] { return _.flatMap(this.columns, (c) => c.cellIds); }
  get headerCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }
  get bodyCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  set visible(visible: boolean) { this.each((c) => c.visible = visible); }
  get length(): number { return this.columnIds.length; }

  rowCells(row: number | RowId, isHead: boolean = false): Cells<T> { return Cells[_makeInstance](this.quickTable, _.map(this.columns, (c) => c.cellId(row, isHead))); }
  headerRowCells(row: number | RowId): Cells<T> { return this.rowCells(row, true); }
}

export class Row<T> extends EventEmitter {
  /* @internal */
  private readonly _cells: Dictionary<Cell<T>> = {};
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _rowId: RowId;
  /* @internal */
  private constructor(quickTable: QuickTable<T>, rowId: RowId) {
    super();
    this._quickTable = quickTable;
    this._rowId = rowId;
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, rowId: RowId): Row<T> { return new Row(quickTable, rowId); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get rowId(): RowId { return this._rowId; }
  get isHead(): boolean { return this.rowId.isHead; }
  get index(): number { return this.rowId.rowIndex; }
  get $(): JQuery { return this.quickTable.getSection(this.isHead).find('tr').eq(this.index); }
  get $cells(): JQuery { return this.$.find('th,td'); }
  get visible(): boolean { return this.$.is(function(this: any) { return $(this).css('display') != 'none'; }); }
  set visible(visible: boolean) {
    const oldVisible: boolean = this.visible;
    this.$[visible ? 'show' : 'hide']();
    this.trigger('row.visible', {
      rowId: this.rowId,
      oldValue: oldVisible,
      newValue: visible,
      visible
    });
  }

  cell(column: number | ColumnId): Cell<T> | null {
    column = columnId(column);
    if(!_.inRange(column.columnIndex, this.length)) { return null; }
    if(!(this._cells[String(column)] instanceof Cell)) {
      this._cells[String(column)] = Cell[_makeInstance](this.quickTable, this.cellId(column));
    }
    return this._cells[String(column)];
  }

  cellId(column: number | ColumnId): CellId { return cellId(this.rowId, column); }
  get cellIds(): CellId[] { return _.map(_.range(this.length), (i) => this.cellId(i)); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  get length(): number { return this.$cells.length; }
  get cellHtmlData(): string[] { return this.cells.htmlData; }
  get cellTextData(): string[] { return this.cells.textData; }
  get cellData(): any[] { return this.cells.data; }
  get cellRawData(): any[] { return this.cells.rawData; }
  get data(): string[] | T {
    if(this.quickTable.rawSortedData && this.quickTable.rawSortedData.length > this.index) {
      return this.quickTable.rawSortedData[this.index];
    }
    return this.cellHtmlData;
  }
}

export class Rows<T> extends QTIterable<Rows<T>, Row<T>> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _rowIds: RowId[];
  /* @internal */
  private constructor(quickTable: QuickTable<T>, rowIds: (RowId | Row<T> | Rows<T>)[]) {
    super(() => this, (r: Rows<T>) => r.rows, (e: Row<T>[]) => Rows[_makeInstance](this.quickTable, e));
    this._quickTable = quickTable;
    this._rowIds = _.flatMap(_.flatten([rowIds]), (r) => {
      if(r instanceof Row) { return r.rowId; }
      if(r instanceof Rows) { return r.rowIds; }
      return r;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, rowIds: (RowId | Row<T> | Rows<T>)[]): Rows<T> { return new Rows(quickTable, rowIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get rowIds(): RowId[] { return this._rowIds; }
  get rows(): Row<T>[] { return _.filter(_.map(this.rowIds, (r) => this.quickTable.row(r))) as Row<T>[]; }
  get $(): JQuery { return $(_.flatMap(this.rows, (r) => r.$.get())); }
  get $cells(): JQuery { return $(_.flatMap(this.rows, (r) => r.$cells.get())); }
  get length(): number { return this.rowIds.length; }
  columnCellIds(column: number | ColumnId): CellId[] { return _.map(this.rows, (r) => r.cellId(column)); }
  columnCells(column: number | ColumnId): Cells<T> { return Cells[_makeInstance](this.quickTable, this.columnCellIds(column)); }
  get cellIds(): CellId[] { return _.flatMap(this.rows, (r) => r.cellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  get cellHtmlData(): string[][] { return _.map(this.rows, (r) => r.cellHtmlData); }
  get cellTextData(): string[][] { return _.map(this.rows, (r) => r.cellTextData); }
  get cellData(): any[][] { return _.map(this.rows, (r) => r.cellData); }
  get cellRawData(): any[][] { return _.map(this.rows, (r) => r.cellRawData); }
  get data(): Array<string[] | T> { return _.map(this.rows, (r) => r.data); }
  set visible(visible: boolean) { this.each((r) => r.visible = visible); }
}

export class QTDo<T, S> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private readonly _selection: S | null;
  /* @internal */
  private constructor(quickTable: QuickTable<T>, selection: S | null) {
    this._quickTable = quickTable;
    this._selection = selection;
  }

  /* @internal */
  static [_makeInstance]<T, S>(quickTable: QuickTable<T>, selection: S | null) { return new QTDo<T, S>(quickTable, selection); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get selection(): S | null { return this._selection; }
  do(action: (selection: S) => void): void { if(this.selection) { action(this.selection as S); } }
  get<R>(getter: (selection: S) => (R | null)): R | null { return this.selection ? getter(this.selection as S) : null; }
}

export class QTWhen<T> {
  /* @internal */
  private readonly _quickTable: QuickTable<T>;
  /* @internal */
  private constructor(quickTable: QuickTable<T>) {
    this._quickTable = quickTable;
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>) { return new QTWhen(quickTable); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  column(column: number | ColumnId): QTDo<T, Column<T>> { return QTDo[_makeInstance](this.quickTable, this.quickTable.column(column)); }
  row(row: number | RowId, isHead: boolean = false): QTDo<T, Row<T>> { return QTDo[_makeInstance](this.quickTable, this.quickTable.row(row, isHead)); }
  headerRow(row: number | RowId): QTDo<T, Row<T>> { return QTDo[_makeInstance](this.quickTable, this.quickTable.headerRow(row)); }
  cell(row: number | RowId | CellId, column: number | ColumnId = 0, isHead: boolean = false): QTDo<T, Cell<T>> { return QTDo[_makeInstance](this.quickTable, this.quickTable.cell(row, column, isHead)); }
  headerCell(row: number | RowId, column: number | ColumnId = 0): QTDo<T, Cell<T>> { return QTDo[_makeInstance](this.quickTable, this.quickTable.headerCell(row, column)); }
}

//based on DataTables
/* @internal */
function createSearch(search: string, regex: boolean = false, smart: boolean = true, caseInsensitive: boolean = true): RegExp {
  if(!regex) { search = _.escapeRegExp(search); }
  if(smart) {
    const parts: string[] = _.map(search.match(/"[^"]+"|[^ ]+/g) || [''], (word: string) => {
      if(word.charAt(0) === '"') {
        const m: RegExpMatchArray | null = word.match(/^"(.*)"$/);
        word = m ? m[1] : word;
      }

      return word.replace('"', '');
    });

    search = '^(?=.*?' + parts.join(')(?=.*?') + ').*$';
  }

  return new RegExp(search, caseInsensitive ? 'i' : '');
}

/* @internal */
function checkFilter<T>(f: RegExp, c: Cell<T> | null, columnDef: ColumnDef<T> | null | undefined): boolean {
  return !f || !c || types.matches(columnDef && columnDef.type, f, c.data);
}

/* @internal */
function getCellData<T>(def: ColumnDef<T>, d: T): any {
  let fieldData: any = null;
  if(def.data) {
    fieldData = (d as Dictionary<any>)[def.data];
  }
  if(typeof def.render == 'function') {
    fieldData = def.render(fieldData, d);
  }
  return fieldData;
}

export declare type SortDef = [number, 'asc' | 'desc'];

export class QuickTable<T> extends EventEmitter {
  /* @internal */
  private readonly _table: JQuery;
  /* @internal */
  private readonly _columns: Dictionary<Column<T>> = {};
  /* @internal */
  private readonly _rows: Dictionary<Row<T>> = {};
  /* @internal */
  private _columnDefs: ColumnDef<T>[] = [];
  /* @internal */
  private _data: string[][] | T[] = [];
  /* @internal */
  private _sortedData: string[][] | T[] = [];
  /* @internal */
  private _dataSorted: boolean = false;
  /* @internal */
  private _sortOrders: SortDef[] = [];
  /* @internal */
  private _when: QTWhen<T> = QTWhen[_makeInstance](this);
  /* @internal */
  private _emptyMessage: string = 'No Data';
  /* @internal */
  private _loadingMessage: string = 'Loading...';
  /* @internal */
  private _loading: boolean = true;
  /* @internal */
  private _autoDraw: boolean = true;
  /* @internal */
  private _clearOnLoad: boolean = true;
  /* @internal */
  private _id: any = null;
  /* @internal */
  private readonly _inInit: boolean = false;
  /* @internal */
  private readonly _filters: RegExp[] = [];
  /* @internal */
  private _clickHandler: ((this: HTMLTableCellElement, value: any, row: T | string[], index: number) => void) | null = null;
  /* @internal */
  private constructor(table: JQuery, initFunc: ((table: QuickTable<T>) => void) | null = null) {
    super();
    this._table = $(table);
    if(initFunc && typeof initFunc == 'function') {
      this._inInit = true;
      initFunc(this);
      this._inInit = false;
    }
    if(this.autoDraw) { this.draw(); }
  }

  /* @internal */
  static [_makeInstance]<T>(table: JQuery, initFunc: ((table: QuickTable<T>) => void) | null = null): QuickTable<T> { return new QuickTable(table, initFunc); }

  get autoDraw(): boolean { return this._autoDraw; }
  set autoDraw(autoDraw: boolean) { this._autoDraw = autoDraw; }
  get clearOnLoad(): boolean { return this._clearOnLoad; }
  set clearOnLoad(clearOnLoad: boolean) { this._clearOnLoad = clearOnLoad; }
  get id(): any { return this._id; }
  set id(id: any) { this._id = id; }
  get clickHandler(): ((this: HTMLTableCellElement, value: any, row: T | string[], index: number) => void) | null { return this._clickHandler; }
  set clickHandler(value: ((this: HTMLTableCellElement, value: any, row: T | string[], index: number) => void) | null) { this._clickHandler = value; }

  chain(func: (table: this) => void): this {
    func(this);
    return this;
  }

  get emptyMessage(): string { return this._emptyMessage; }
  set emptyMessage(value: string) {
    this._emptyMessage = value;
    if(!this._data || this._data.length == 0) {
      if(this.autoDraw) { this.draw(); }
    }
  }

  get loadingMessage(): string { return this._loadingMessage; }
  set loadingMessage(value: string) {
    this._loadingMessage = value;
    if(!this._data || this._data.length == 0) {
      if(this.autoDraw) { this.draw(); }
    }
  }

  get loading(): boolean { return this._loading; }
  set loading(value: boolean) {
    this._loading = value;
    if(this.clearOnLoad && value) {
      this.data = null;
    }
    if(!this._data || this._data.length == 0) {
      if(this.autoDraw) { this.draw(); }
    }
  }

  get sortOrders(): SortDef[] { return this._sortOrders; }
  set sortOrders(sortOrders: SortDef[]) {
    this._sortOrders = sortOrders;
    this._dataSorted = false;
  }

  toggleSort(columnIndex: number): this {
    if(columnIndex >= this.columnCount) { return this; }
    this._dataSorted = false;
    const existingOrder: SortDef | undefined = _.find(this.sortOrders, (o: SortDef) => o[0] == columnIndex);
    const newOrder: 'asc' | 'desc' = existingOrder && existingOrder[1] == 'asc' ? 'desc' : 'asc';
    return this.addSort(columnIndex, newOrder);
  }

  addSort(columnIndex: number, order: 'asc' | 'desc' = 'asc'): this {
    const existingOrderIndex: number = _.findIndex(this.sortOrders, (o: SortDef) => o[0] == columnIndex);
    if(existingOrderIndex == 0 && this.sortOrders[0][1] == order) { return this; }
    this._dataSorted = false;
    this.sortOrders = _.filter(this.sortOrders, (o: SortDef) => o[0] !== columnIndex);
    const newOrder: SortDef = [columnIndex, order];
    this.sortOrders = _.concat([newOrder], this.sortOrders);
    this.sortData();
    if(this.autoDraw) { this.draw(); }
    return this;
  }

  /* @internal */
  private get filters(): RegExp[] { return this._filters; }

  /* @internal */
  [_setFilter](columnIndex: number, filter: string, regex: boolean = false, smart: boolean = true, caseInsensitive: boolean = true): void {
    while(this.filters.length < this.columnCount) {
      this.filters.push(createSearch(''));
    }
    if(columnIndex >= this.columnCount) { return; }
    this.filters[columnIndex] = createSearch(filter, regex, smart, caseInsensitive);
  }

  applyFilters(): this {
    this.rows
      .partitionOutOver(this.filters, (r: Row<T>, f: RegExp, i: number) => checkFilter(f, r.cell(i), this.columnDefs[i]))
      .withIncluded((r) => r.visible = true)
      .withExcluded((r) => r.visible = false);
    return this;
  }

  resetFilters(): this {
    _.times(this.columnCount, (i: number) => this[_setFilter](i, ''));
    return this;
  }

  clearFilters(): this { return this.resetFilters().applyFilters(); }

  get when(): QTWhen<T> { return this._when; }
  get $(): JQuery { return this._table; }
  getSection(isHead: boolean): JQuery { return this.$.find(isHead ? 'thead' : 'tbody'); }
  get $head(): JQuery { return this.getSection(true); }
  get $body(): JQuery { return this.getSection(false); }
  get columnCount(): number { return this.$.find('tr').eq(0).find('th,td').length; }
  get columns(): Columns<T> { return Columns[_makeInstance](this, this.columnIds); }
  get columnIds(): ColumnId[] { return _.map(_.range(this.columnCount), (i) => this.columnId(i)); }

  column(column: number | ColumnId): Column<T> | null {
    column = columnId(column);
    if(!_.inRange(column.columnIndex, this.columnCount)) { return null; }
    if(!(this._columns[String(column)] instanceof Column)) {
      this._columns[String(column)] = Column[_makeInstance](this, column);
    }
    return this._columns[String(column)];
  }

  columnId(column: number | ColumnId): ColumnId { return columnId(column); }
  getColumns(...columns: (number | ColumnId)[]): Columns<T> { return Columns[_makeInstance](this, _.map(_.flatten(columns), (c) => this.columnId(c))); }
  getRowCount(isHead: boolean): number { return this[isHead ? '$head' : '$body'].find('tr').length; }
  get rowCount(): number { return this.getRowCount(false); }
  get headerRowCount(): number { return this.getRowCount(true); }
  getAllRows(isHead: boolean): Rows<T> { return Rows[_makeInstance](this, this.getAllRowIds(isHead)); }
  getAllRowIds(isHead: boolean): RowId[] { return _.map(_.range(this.getRowCount(isHead)), (i) => this.rowId(i, isHead)); }
  get rows(): Rows<T> { return this.getAllRows(false); }
  get headerRows(): Rows<T> { return this.getAllRows(true); }
  get rowIds(): RowId[] { return this.getAllRowIds(false); }
  get headerRowIds(): RowId[] { return this.getAllRowIds(true); }
  getBodyRows(...rows: (number | RowId)[]): Rows<T> { return Rows[_makeInstance](this, _.map(_.flatten(rows), (r) => this.rowId(r, false))); }
  getHeaderRows(...rows: (number | RowId)[]): Rows<T> { return Rows[_makeInstance](this, _.map(_.flatten(rows), (r) => this.rowId(r, true))); }
  getRows(...rowIds: RowId[]): Rows<T> { return Rows[_makeInstance](this, _.filter(_.flatten(rowIds), (r) => r instanceof RowId)); }

  row(row: number | RowId, isHead: boolean = false): Row<T> | null {
    row = rowId(row, isHead);
    if(!_.inRange(row.rowIndex, this.getRowCount(row.isHead))) { return null; }
    if(!(this._rows[String(row)] instanceof Row)) {
      this._rows[String(row)] = Row[_makeInstance](this, row);
    }
    return this._rows[String(row)];
  }

  rowId(row: number | RowId, isHead: boolean = false): RowId { return rowId(row, isHead); }
  headerRow(row: number | RowId): Row<T> | null { return this.row(row, true); }
  headerRowId(row: number | RowId): RowId { return this.rowId(row, true); }

  cell(row: number | RowId | CellId, column: number | ColumnId = 0, isHead: boolean = false): Cell<T> | null {
    const cell: CellId = cellId(row, column, isHead);
    return ((r) => r && r.cell(cell.columnId))(this.row(cell.rowId));
  }

  headerCell(row: number | RowId, column: number | ColumnId): Cell<T> | null { return this.cell(row, column, true); }

  get columnDefs(): ColumnDef<T>[] { return this._columnDefs; }
  set columnDefs(columnDefs: ColumnDef<T>[]) {
    if(columnDefs.length < this.columnCount) {
      throw `Not enough columnDefs have been provided. Have ${this.columnCount} columns, but only ${columnDefs.length} columnDefs.`;
    }
    this._columnDefs = columnDefs;
    if(this.autoDraw) {
      this.draw();
    }
  }

  get rawData(): string[][] | T[] { return this._data; }
  get rawSortedData(): string[][] | T[] { return this._sortedData; }
  get sortedData(): string[][] | T[] | null {
    if(this._sortedData && this._sortedData.length > 0) {
      return this._sortedData;
    }
    return this.cellTextData;
  }

  get cellHtmlData(): string[][] { return this.rows.cellHtmlData; }
  get cellTextData(): string[][] { return this.rows.cellTextData; }

  sortData(forceSort: boolean = false): this {
    if(this._dataSorted && !forceSort) { return this; }
    if(!this._data || this._data.length == 0) {
      this._sortedData = [];
      return this;
    }
    const colDefs: ColumnDef<T>[] = this.columnDefs;
    if(!colDefs || colDefs.length == 0) {
      // rows are arrays
      this._sortedData = _.clone(this._data);
      (this._sortedData as string[][]).sort((a: string[], b: string[]) => {
        for(let i: number = 0; i < this.sortOrders.length; i++) {
          const sortOrder: SortDef = this.sortOrders[i];
          const colInd: number = sortOrder[0];
          if(colInd < a.length && colInd < b.length) {
            const cellA: string = a[colInd];
            const cellB: string = b[colInd];
            const comp: number = types.compare(null, cellA, cellB) * (sortOrder[1] == 'desc' ? -1 : 1);
            if(comp != 0) { return comp; }
          }
        }
        return 0;
      });
    } else {
      // rows use columnDefs
      this._sortedData = _.clone(this._data);
      (this._sortedData as T[]).sort((a: T, b: T) => {
        for(let i: number = 0; i < this.sortOrders.length; i++) {
          const sortOrder: SortDef = this.sortOrders[i];
          const colInd: number = sortOrder[0];
          if(colInd < colDefs.length) {
            const def: ColumnDef<T> = colDefs[colInd];
            const cellA: any = getCellData(def, a);
            const cellB: any = getCellData(def, b);
            const comp: number = types.compare(def.type, cellA, cellB) * (sortOrder[1] == 'desc' ? -1 : 1);
            if(comp != 0) { return comp; }
          }
        }
        return 0;
      });
    }
    this._dataSorted = true;
    return this;
  }

  get data(): string[][] | T[] | null {
    if(this._data && this._data.length > 0) {
      return this._data;
    }
    return this.cellTextData;
  }

  set data(data: string[][] | T[] | null) {
    this._dataSorted = false;
    if(!data || data.length == 0) {
      this._data = [];
      this.sortData();
      if(this.autoDraw) { this.draw(); }
      return;
    }
    if(!_.isArray(data)) {
      throw 'data must be an array';
    }
    const colCount: number = this.columnCount;
    const colDefCount: number = this.columnDefs ? this.columnDefs.length : 0;
    if(colDefCount == 0) {
      if(_.some(data, (d) => !_.isArray(d))) {
        throw 'You must provide the data rows as arrays when columnDefs has not been set';
      }
      const minSize: number = _.min(_.map(data, (d) => (d as string[]).length)) || 0;
      if(minSize < colCount) {
        throw `One or more data rows had a size below the column count of ${colCount}. Minimum data row size: ${minSize}`;
      }
      this._data = data;
      this.sortData();
      if(this.autoDraw) { this.draw(); }
    } else if(colDefCount < colCount) {
      throw `Not enough columnDefs have been provided. Have ${colCount} columns, but only ${colDefCount} columnDefs.`;
    } else {
      this._data = data;
      this.sortData();
      if(this.autoDraw) { this.draw(); }
    }
  }

  draw(): this {
    if(this._inInit) { return this; }
    const $body: JQuery = this.$body;
    $body.empty();
    if(!this._data || this._data.length == 0) {
      if((this.loading && this.loadingMessage) || this.emptyMessage) {
        const $row: JQuery = $('<tr>');
        const $cell: JQuery = $('<td>');
        $cell.attr('colspan', this.columnCount);
        $cell.html((this.loading && this.loadingMessage) || this.emptyMessage);
        $row.append($cell);
        $body.append($row);
      }
      return this.trigger('draw.empty');
    }
    this.loading = false;
    this.sortData();
    const colDefs: ColumnDef<T>[] = this.columnDefs;
    const colCount: number = this.columnCount;
    if(!colDefs || colDefs.length == 0) {
      // rows are arrays
      _.each(this._sortedData as string[][], (d: string[], index: number) => {
        const $row: JQuery = $('<tr>');
        for(let i = 0; i < colCount; i++) {
          const $cell: JQuery<HTMLTableCellElement> = $('<td>');
          const cellValue: string = (d as string[])[i];
          $cell.text(cellValue);
          $row.append($cell);
          if(this.clickHandler) {
            $cell.on('click', () => {
              this.clickHandler?.call($cell.get(0) as HTMLTableCellElement, cellValue, d as string[], index);
            });
          }
        }
        $body.append($row);
      });
    } else {
      // rows use columnDefs
      _.each(this._sortedData as T[], (d: T, index: number) => {
        const $row = $('<tr>');
        for(let i = 0; i < colCount; i++) {
          const def: ColumnDef<T> = colDefs[i];
          let $cell: JQuery;
          if(def.cellType == 'th') {
            $cell = $('<th>');
          } else {
            $cell = $('<td>');
          }
          let fieldData: any = null;
          if(def.data) {
            fieldData = (d as Dictionary<any>)[def.data];
          }
          if(typeof def.render == 'function') {
            fieldData = def.render(fieldData, d);
          }
          if(fieldData) {
            if(def.html) {
              $cell.html(fieldData);
            } else {
              $cell.text(fieldData);
            }
          }
          if(def.cssClass) {
            $cell.addClass(def.cssClass);
          }
          $row.append($cell);
          if(this.clickHandler) {
            $cell.on('click', () => {
              this.clickHandler?.call($cell.get(0) as HTMLTableCellElement, fieldData, d, index);
            });
          }
        }
        $body.append($row);
      });
    }
    return this.trigger('draw');
  }
}

/* @internal */
const _addTable = Symbol('addTable');

export class QuickTables<T> extends QTIterable<QuickTables<T>, QuickTable<T>> {
  /* @internal */
  private readonly _tables: QuickTable<T>[] = [];
  /* @internal */
  private constructor(tables: (QuickTable<T> | QuickTables<T>)[] = []) {
    super(() => this, (t: QuickTables<T>) => t.tables, (e: QuickTable<T>[]) => QuickTables[_makeInstance](e));
    this._tables = _.flatMap(_.flatten([tables]), (t) => {
      if(t instanceof QuickTables) { return t.tables; }
      return t;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(tables: QuickTable<T>[] = []): QuickTables<T> { return new QuickTables(tables); }

  get tables(): QuickTable<T>[] { return _.clone(this._tables); }
  get length(): number { return this._tables.length; }
  get(index: number): QuickTable<T> { return this._tables[index]; }
  getById(id: any): QuickTable<T> | undefined { return this.find((t) => t.id == id); }
  getAll(...indexes: number[]): QuickTables<T> { return new QuickTables(_.filter(_.map(indexes, (i) => this.get(i)))); }
  getAllById(...ids: any[]): QuickTables<T> { return new QuickTables(_.filter(_.map(ids, (i) => this.getById(i))) as QuickTable<T>[]); }

  /* @internal */
  [_addTable](table: QuickTable<T>): void {
    if(table instanceof QuickTable) {
      this._tables.push(table);
    }
  }

  draw(): this { return this.each((t) => t.draw()); }
}

export function setup(jQuery: JQueryStatic, lodash: LoDashStatic) {
  $ = jQuery;
  _ = lodash;
  setupDefaultTypes();
  const qt: any = function <T>(this: JQuery, initFunc: ((table: QuickTable<T>) => void) | null = null): QuickTable<T> | QuickTables<T> {
    const tables: QuickTables<T> = QuickTables[_makeInstance]();
    this.filter('table').each(function(this: any) {
      const $this: JQuery = $(this);
      let table: QuickTable<T> | null = $this.data('quickTable');
      if(!table) {
        table = QuickTable[_makeInstance]($this, initFunc);
        $this.data('quickTable', table);
      }
      tables[_addTable](table);
    });
    if(tables.length == 1) {
      return tables.get(0);
    }
    return tables;
  };

  qt.columnId = columnId;
  qt.rowId = rowId;
  qt.cellId = cellId;
  qt.types = types;

  jQuery.fn.QuickTable = qt;
}
