import { LoDashStatic } from 'lodash';

declare type Listener = (...args: any[]) => any;

export interface JQueryQuickTable {
  <T>(initFunc?: ((table: QuickTable<T>) => void) | null): QuickTable<T> | QuickTables<T>;
  columnId(column: number | ColumnId): ColumnId;
  rowId(row: number | RowId, isHead?: boolean): RowId;
  cellId(row: number | RowId | CellId, column?: number | ColumnId, isHead?: boolean): CellId
}

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
declare interface Map<V> {
  [key: string]: V;
  [key: number]: V;
}

/* @internal */
const _makeInstance = Symbol('makeInstance');

export declare interface ColumnDef<T> {
  cellType?: string;
  data?: string;
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
const columnIds: Map<ColumnId> = {};

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
  private readonly cellIds: Map<CellId> = {};
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
const rowIds: { head: Map<RowId>, body: Map<RowId> } = {
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
  private readonly _listeners: Map<Listener[]> = {};
  /* @internal */
  protected constructor() { }

  /* @internal */
  private get listeners(): Map<Listener[]> { return this._listeners; }

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
    let p: [T, T] = base[_partition](iter);
    p[modInd] = p[modInd].joinWith(other);
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
  joinWith(...parts: T[]): T { return this.maker(_.flatMap(_.concat([], this.self, parts), p => p.toArray())); }
  partition(iter: (e: E) => boolean): QTPartition<T, E> { return QTPartition[_makeInstance](this[_partition](iter)); }
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
    if(this.quickTable.rawData && this.quickTable.rawData.length > this.rowIndex && this.quickTable.columnDefs && this.quickTable.columnDefs.length > this.columnIndex) {
      const def: ColumnDef<T> = this.quickTable.columnDefs[this.columnIndex];
      if(typeof def.render == 'function') {
        return this.textData;
      }
      const d: T = this.quickTable.rawData[this.rowIndex] as T;
      let fieldData: any = null;
      if(def.data) {
        fieldData = (d as Map<any>)[def.data];
        return fieldData;
      }
    }
    return this.textData;
  }
  get rawData(): any {
    if(this.quickTable.rawData && this.quickTable.rawData.length > this.rowIndex && this.quickTable.columnDefs && this.quickTable.columnDefs.length > this.columnIndex) {
      const d: T = this.quickTable.rawData[this.rowIndex] as T;
      const def: ColumnDef<T> = this.quickTable.columnDefs[this.columnIndex];
      let fieldData: any = null;
      if(def.data) {
        fieldData = (d as Map<any>)[def.data];
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
    this._cellIds = _.flatMap(_.flatten([cellIds]), c => {
      if(c instanceof Cell) { return c.cellId; }
      if(c instanceof Cells) { return c.cellIds; }
      return c;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, cellIds: (CellId | Cell<T> | Cells<T>)[]): Cells<T> { return new Cells(quickTable, cellIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get cellIds(): CellId[] { return this._cellIds; }
  get cells(): Cell<T>[] { return _.filter(_.map(this.cellIds, c => this.quickTable.cell(c))) as Cell<T>[]; }
  get $(): JQuery { return _.reduce(this.cells, (col: JQuery, c: Cell<T>) => col.add(c.$), $()) as JQuery; }
  get htmlData(): string[] { return _.map(this.cells, c => c.htmlData); }
  get textData(): string[] { return _.map(this.cells, c => c.textData); }
  get data(): any[] { return _.map(this.cells, c => c.data); }
  get rawData(): any[] { return _.map(this.cells, c => c.rawData); }
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
    let oldVisible: boolean = this.visible;
    this.$[visible ? 'show' : 'hide']();
    this.trigger('column.visible', {
      columnId: this.columnId,
      oldValue: oldVisible,
      newValue: visible,
      visible
    });
  }

  cell(row: number | RowId, isHead: boolean = false): Cell<T> | null { return (r => r && r.cell(this.columnId))(this.quickTable.row(row, isHead)); }
  headerCell(row: number | RowId): Cell<T> | null { return this.cell(row, true); }
  cellId(row: number | RowId, isHead: boolean = false): CellId { return cellId(row, this.columnId, isHead); }
  get headerCellIds(): CellId[] { return _.map(_.range(this.quickTable.headerRowCount), r => this.cellId(r, true)); }
  get bodyCellIds(): CellId[] { return _.map(_.range(this.quickTable.rowCount), r => this.cellId(r, false)); }
  get cellIds(): CellId[] { return _.concat([], this.headerCellIds, this.bodyCellIds); }
  get headerCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }
  get bodyCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
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
    this._columnIds = _.flatMap(_.flatten([columnIds]), c => {
      if(c instanceof Column) { return c.columnId; }
      if(c instanceof Columns) { return c.columnIds; }
      return c;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, columnIds: (ColumnId | Column<T> | Columns<T>)[]): Columns<T> { return new Columns(quickTable, columnIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get columnIds(): ColumnId[] { return this._columnIds; }
  get columns(): Column<T>[] { return _.filter(_.map(this.columnIds, c => this.quickTable.column(c))) as Column<T>[]; }
  get $head(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$head), $()); }
  get $body(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$body), $()); }
  get $(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column<T>) => col.add(c.$), $()); }
  get headerCellIds(): CellId[] { return _.flatMap(this.columns, c => c.headerCellIds); }
  get bodyCellIds(): CellId[] { return _.flatMap(this.columns, c => c.bodyCellIds); }
  get cellIds(): CellId[] { return _.flatMap(this.columns, c => c.cellIds); }
  get headerCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }
  get bodyCells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  set visible(visible: boolean) { this.each(c => c.visible = visible); }
  get length(): number { return this.columnIds.length; }

  rowCells(row: number | RowId, isHead: boolean = false): Cells<T> { return Cells[_makeInstance](this.quickTable, _.map(this.columns, c => c.cellId(row, isHead))); }
  headerRowCells(row: number | RowId): Cells<T> { return this.rowCells(row, true); }
}

export class Row<T> extends EventEmitter {
  /* @internal */
  private readonly _cells: Map<Cell<T>> = {};
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
    let oldVisible: boolean = this.visible;
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
  get cellIds(): CellId[] { return _.map(_.range(this.length), i => this.cellId(i)); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  get length(): number { return this.$cells.length; }
  get cellHtmlData(): string[] { return this.cells.htmlData; }
  get cellTextData(): string[] { return this.cells.textData; }
  get data(): string[] | T {
    if(this.quickTable.rawData && this.quickTable.rawData.length > this.index) {
      return this.quickTable.rawData[this.index];
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
    this._rowIds = _.flatMap(_.flatten([rowIds]), r => {
      if(r instanceof Row) { return r.rowId; }
      if(r instanceof Rows) { return r.rowIds; }
      return r;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(quickTable: QuickTable<T>, rowIds: (RowId | Row<T> | Rows<T>)[]): Rows<T> { return new Rows(quickTable, rowIds); }

  get quickTable(): QuickTable<T> { return this._quickTable; }
  get rowIds(): RowId[] { return this._rowIds; }
  get rows(): Row<T>[] { return _.filter(_.map(this.rowIds, r => this.quickTable.row(r))) as Row<T>[]; }
  get $(): JQuery { return $(_.flatMap(this.rows, r => r.$.get())); }
  get $cells(): JQuery { return $(_.flatMap(this.rows, r => r.$cells.get())); }
  get length(): number { return this.rowIds.length; }
  columnCellIds(column: number | ColumnId): CellId[] { return _.map(this.rows, r => r.cellId(column)); }
  columnCells(column: number | ColumnId): Cells<T> { return Cells[_makeInstance](this.quickTable, this.columnCellIds(column)); }
  get cellIds(): CellId[] { return _.flatMap(this.rows, r => r.cellIds); }
  get cells(): Cells<T> { return Cells[_makeInstance](this.quickTable, this.cellIds); }
  get cellHtmlData(): string[][] { return _.map(this.rows, r => r.cellHtmlData); }
  get cellTextData(): string[][] { return _.map(this.rows, r => r.cellTextData); }
  get data(): string[][] | Object[] { return _.map(this.rows, r => r.data); }
  set visible(visible: boolean) { this.each(r => r.visible = visible); }
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

export class QuickTable<T> extends EventEmitter {
  /* @internal */
  private readonly _table: JQuery;
  /* @internal */
  private readonly _columns: Map<Column<T>> = {};
  /* @internal */
  private readonly _rows: Map<Row<T>> = {};
  /* @internal */
  private _columnDefs: ColumnDef<T>[] = [];
  /* @internal */
  private _data: string[][] | T[] = [];
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

  get when(): QTWhen<T> { return this._when; }
  get $(): JQuery { return this._table; }
  getSection(isHead: boolean): JQuery { return this.$.find(isHead ? 'thead' : 'tbody'); }
  get $head(): JQuery { return this.getSection(true); }
  get $body(): JQuery { return this.getSection(false); }
  get columnCount(): number { return this.$.find('tr').eq(0).find('th,td').length; }
  get columns(): Columns<T> { return Columns[_makeInstance](this, this.columnIds); }
  get columnIds(): ColumnId[] { return _.map(_.range(this.columnCount), i => this.columnId(i)); }

  column(column: number | ColumnId): Column<T> | null {
    column = columnId(column);
    if(!_.inRange(column.columnIndex, this.columnCount)) { return null; }
    if(!(this._columns[String(column)] instanceof Column)) {
      this._columns[String(column)] = Column[_makeInstance](this, column);
    }
    return this._columns[String(column)];
  }

  columnId(column: number | ColumnId): ColumnId { return columnId(column); }
  getColumns(...columns: (number | ColumnId)[]): Columns<T> { return Columns[_makeInstance](this, _.map(_.flatten(columns), c => this.columnId(c))); }
  getRowCount(isHead: boolean): number { return this[isHead ? '$head' : '$body'].find('tr').length; }
  get rowCount(): number { return this.getRowCount(false); }
  get headerRowCount(): number { return this.getRowCount(true); }
  getAllRows(isHead: boolean): Rows<T> { return Rows[_makeInstance](this, this.getAllRowIds(isHead)); }
  getAllRowIds(isHead: boolean): RowId[] { return _.map(_.range(this.getRowCount(isHead)), i => this.rowId(i, isHead)); }
  get rows(): Rows<T> { return this.getAllRows(false); }
  get headerRows(): Rows<T> { return this.getAllRows(true); }
  get rowIds(): RowId[] { return this.getAllRowIds(false); }
  get headerRowIds(): RowId[] { return this.getAllRowIds(true); }
  getBodyRows(...rows: (number | RowId)[]): Rows<T> { return Rows[_makeInstance](this, _.map(_.flatten(rows), r => this.rowId(r, false))); }
  getHeaderRows(...rows: (number | RowId)[]): Rows<T> { return Rows[_makeInstance](this, _.map(_.flatten(rows), r => this.rowId(r, true))); }
  getRows(...rowIds: RowId[]): Rows<T> { return Rows[_makeInstance](this, _.filter(_.flatten(rowIds), r => r instanceof RowId)); }

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
    let cell: CellId = cellId(row, column, isHead);
    return (r => r && r.cell(cell.columnId))(this.row(cell.rowId));
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
  get data(): string[][] | T[] | null {
    if(this._data && this._data.length > 0) {
      return this._data;
    }
    return this.cellTextData;
  }

  get cellHtmlData(): string[][] { return this.rows.cellHtmlData; }
  get cellTextData(): string[][] { return this.rows.cellTextData; }

  set data(data: string[][] | T[] | null) {
    if(!data || data.length == 0) {
      this._data = [];
      if(this.autoDraw) { this.draw(); }
      return;
    }
    if(!_.isArray(data)) {
      throw 'data must be an array';
    }
    let colCount: number = this.columnCount;
    let colDefCount: number = this.columnDefs ? this.columnDefs.length : 0;
    if(colDefCount == 0) {
      if(_.some(data, d => !_.isArray(d))) {
        throw 'You must provide the data rows as arrays when columnDefs has not been set';
      }
      let minSize: number = _.min(_.map(data, d => (d as string[]).length)) || 0;
      if(minSize < colCount) {
        throw `One or more data rows had a size below the column count of ${colCount}. Minimum data row size: ${minSize}`;
      }
      this._data = data;
      if(this.autoDraw) { this.draw(); }
    } else if(colDefCount < colCount) {
      throw `Not enough columnDefs have been provided. Have ${colCount} columns, but only ${colDefCount} columnDefs.`;
    } else {
      this._data = data;
      if(this.autoDraw) { this.draw(); }
    }
  }

  draw(): this {
    if(this._inInit) { return this; }
    let $body: JQuery = this.$body;
    $body.empty();
    if(!this._data || this._data.length == 0) {
      if((this.loading && this.loadingMessage) || this.emptyMessage) {
        let $row: JQuery = $('<tr>');
        let $cell: JQuery = $('<td>');
        $cell.attr('colspan', this.columnCount);
        $cell.html((this.loading && this.loadingMessage) || this.emptyMessage);
        $row.append($cell);
        $body.append($row);
      }
      return this.trigger('draw.empty');
    }
    this.loading = false;
    let colDefs: ColumnDef<T>[] = this.columnDefs;
    let colCount: number = this.columnCount;
    if(!colDefs || colDefs.length == 0) {
      // rows are arrays
      _.each(this._data, d => {
        let $row: JQuery = $('<tr>');
        for(let i = 0; i < colCount; i++) {
          let $cell: JQuery = $('<td>');
          $cell.text((d as string[])[i]);
          $row.append($cell);
        }
        $body.append($row);
      });
    } else {
      // rows use columnDefs
      _.each(this._data as T[], (d: T) => {
        let $row = $('<tr>');
        for(let i = 0; i < colCount; i++) {
          let def: ColumnDef<T> = colDefs[i];
          let $cell: JQuery;
          if(def.cellType == 'th') {
            $cell = $('<th>');
          } else {
            $cell = $('<td>');
          }
          let fieldData: any = null;
          if(def.data) {
            fieldData = (d as Map<any>)[def.data];
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
    this._tables = _.flatMap(_.flatten([tables]), t => {
      if(t instanceof QuickTables) { return t.tables; }
      return t;
    });
  }

  /* @internal */
  static [_makeInstance]<T>(tables: QuickTable<T>[] = []): QuickTables<T> { return new QuickTables(tables); }

  get tables(): QuickTable<T>[] { return _.clone(this._tables); }
  get length(): number { return this._tables.length; }
  get(index: number): QuickTable<T> { return this._tables[index]; }
  getById(id: any): QuickTable<T> | undefined { return this.find(t => t.id == id); }
  getAll(...indexes: number[]): QuickTables<T> { return new QuickTables(_.filter(_.map(indexes, i => this.get(i)))); }
  getAllById(...ids: any[]): QuickTables<T> { return new QuickTables(_.filter(_.map(ids, i => this.getById(i))) as QuickTable<T>[]); }

  /* @internal */
  [_addTable](table: QuickTable<T>): void {
    if(table instanceof QuickTable) {
      this._tables.push(table);
    }
  }

  draw(): this { return this.each(t => t.draw()); }
}

export function setup(jQuery: JQueryStatic, lodash: LoDashStatic) {
  $ = jQuery;
  _ = lodash;
  let qt: any = function <T>(this: JQuery, initFunc: ((table: QuickTable<T>) => void) | null = null): QuickTable<T> | QuickTables<T> {
    let tables: QuickTables<T> = QuickTables[_makeInstance]();
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

  jQuery.fn.QuickTable = qt;
}