import { LoDashStatic } from "lodash";
declare type Listener = (...args: any[]) => any;

declare global {
    interface JQuery {
        (...args: any[]): JQuery;
        fn: any;
    }
}

var $: JQuery;
var _: LoDashStatic;

declare interface Map<V> {
    [key: string]: V;
    [key: number]: V;
}

const _makeInstance = Symbol('makeInstance');

export declare type ColumnDef = { cellType?: string, data?: string, render?: (data: any | null, row: Object) => string, html?: boolean, cssClass?: string };

export class ColumnId {
    private constructor(readonly columnIndex: number) { }

    static [_makeInstance](columnIndex: number): ColumnId { return new ColumnId(columnIndex); }

    toString() { return `ColumnId[${this.columnIndex}]`; }
}

const columnIds: Map<ColumnId> = {};

export function columnId(column: number | ColumnId): ColumnId {
    if (column instanceof ColumnId) { return column; }
    if (!(columnIds[column] instanceof ColumnId)) {
        columnIds[column] = ColumnId[_makeInstance](column);
    }
    return columnIds[column];
}

export class CellId {
    private constructor(readonly rowId: RowId, readonly columnId: ColumnId) { }

    static [_makeInstance](rowId: RowId, columnId: ColumnId): CellId { return new CellId(rowId, columnId); }

    get rowIndex(): number { return this.rowId.rowIndex; }

    get isHead(): boolean { return this.rowId.isHead; }

    get columnIndex(): number { return this.columnId.columnIndex; }

    toString(): string { return `CellId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}, ${this.columnIndex}]`; }
}

const _getCellId = Symbol('getCellId');

export class RowId {
    private cellIds: Map<CellId> = {};
    private constructor(readonly rowIndex: number, readonly isHead: boolean) { }

    static [_makeInstance](rowIndex: number, isHead: boolean): RowId { return new RowId(rowIndex, isHead); }

    [_getCellId](columnId: ColumnId): CellId {
        if (!(this.cellIds[String(columnId)] instanceof CellId)) {
            this.cellIds[String(columnId)] = CellId[_makeInstance](this, columnId);
        }
        return this.cellIds[String(columnId)];
    }

    toString(): string { return `RowId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}]`; }
}

const rowIds: { head: Map<RowId>, body: Map<RowId> } = { head: {}, body: {} };

export function rowId(row: number | RowId, isHead: boolean = false): RowId {
    if (row instanceof RowId) {
        if (!isHead || row.isHead) {
            return row;
        }
        row = row.rowIndex;
    }
    if (!(rowIds[isHead ? 'head' : 'body'][row] instanceof RowId)) {
        rowIds[isHead ? 'head' : 'body'][row] = RowId[_makeInstance](row, isHead);
    }
    return rowIds[isHead ? 'head' : 'body'][row];
}

export function cellId(row: number | RowId | CellId, column: number | ColumnId = 0, isHead = false): CellId {
    if (row instanceof CellId) { return row; }
    return rowId(row, isHead)[_getCellId](columnId(column));
}

export class EventEmitter {
    readonly listeners: Map<Listener[]> = {};
    protected constructor() { }

    on(event: string, handler: Listener): this {
        if (!this.listeners[event]) { this.listeners[event] = []; }
        this.listeners[event].push(handler);
        return this;
    }

    trigger(event: string, ...args: any[]): this {
        if (this.listeners[event] && this.listeners[event].length > 0) {
            _.each(this.listeners[event], (handler: Listener) => {
                handler(...args);
            });
        }
        return this;
    }

    forward(event: string, proxy: EventEmitter): this {
        if (proxy instanceof EventEmitter) {
            this.on(event, (...args) => proxy.trigger(event, ...args));
        }
        return this;
    }
}

export class QTIterable<T> {
    protected getter: (self: this) => T[] = (self: this) => [];

    each(iter: (e: T) => void): this {
        _.each(this.getter(this), iter);
        return this;
    }

    map<R>(iter: (e: T) => R): R[] { return _.map(this.getter(this), iter); }

    flatMap<R>(iter: (e: T) => R): R[] { return _.flatMap(this.getter(this), iter); }

    some(iter: (e: T) => boolean): boolean { return _.some(this.getter(this), iter); }

    every(iter: (e: T) => boolean): boolean { return _.every(this.getter(this), iter); }

    find(iter: (e: T) => boolean): T | undefined { return _.find(this.getter(this), iter); }

    findLast(iter: (e: T) => boolean): T | undefined { return _.findLast(this.getter(this), iter); }
}

export class Cell {
    private constructor(readonly quickTable: QuickTable, readonly cellId: CellId) { }

    static [_makeInstance](quickTable: QuickTable, cellId: CellId): Cell { return new Cell(quickTable, cellId); }

    get rowIndex(): number { return this.cellId.rowIndex; }

    get isHead(): boolean { return this.cellId.isHead; }

    get columnIndex(): number { return this.cellId.columnIndex; }

    get rowId(): RowId { return this.cellId.rowId; }

    get columnId(): ColumnId { return this.cellId.columnId; }

    get row(): Row | null { return this.quickTable.row(this.rowId); }

    get column(): Column | null { return this.quickTable.column(this.columnId); }

    get $(): JQuery { return ((row) => row ? row.$cells.eq(this.columnIndex) : $())(this.row); }

    get htmlData(): string { return this.$.html(); }

    set htmlData(htmlData: string) { this.$.html(htmlData); }

    get textData(): string { return this.$.text(); }

    set textData(textData: string) { this.$.text(textData); }
}

export class Cells extends QTIterable<Cell> {
    readonly cellIds: CellId[];
    private constructor(readonly quickTable: QuickTable, cellIds: (CellId | Cell | Cells)[]) {
        super();
        this.getter = c => c.cells;
        this.cellIds = _.flatMap(_.flatten([cellIds]), c => {
            if (c instanceof Cell) { return c.cellId; }
            if (c instanceof Cells) { return c.cellIds; }
            return c;
        });
    }

    static [_makeInstance](quickTable: QuickTable, cellIds: (CellId | Cell | Cells)[]): Cells { return new Cells(quickTable, cellIds); }

    get cells(): Cell[] { return _.filter(_.map(this.cellIds, c => this.quickTable.cell(c))) as Cell[]; }

    get $(): JQuery { return _.reduce(this.cells, (col: JQuery, c: Cell) => col.add(c.$), $()) as JQuery; }

    get htmlData(): string[] { return _.map(this.cells, c => c.htmlData); }

    get textData(): string[] { return _.map(this.cells, c => c.textData); }

    get length(): number { return this.cellIds.length; }
}

export class Column extends EventEmitter {
    private constructor(readonly quickTable: QuickTable, readonly columnId: ColumnId) {
        super();
        this.forward('column.visible', this.quickTable);
    }

    static [_makeInstance](quickTable: QuickTable, columnId: ColumnId): Column { return new Column(quickTable, columnId); }

    get index(): number { return this.columnId.columnIndex; }

    get $head(): JQuery { return this.quickTable.$.find(`thead tr th:nth-child(${this.index + 1}), thead tr td:nth-child(${this.index + 1})`); }

    get $body(): JQuery { return this.quickTable.$.find(`tbody tr th:nth-child(${this.index + 1}), tbody tr td:nth-child(${this.index + 1})`); }

    get $(): JQuery { return this.$head.add(this.$body); }

    get visible(): boolean { return this.$.is(function (this: any) { return $(this).css('display') != 'none'; }); }

    set visible(visible: boolean) {
        let oldVisible: boolean = this.visible;
        this.$[visible ? 'show' : 'hide']();
        this.trigger('column.visible', { columnId: this.columnId, oldValue: oldVisible, newValue: visible, visible });
    }

    cell(row: number | RowId, isHead: boolean = false): Cell | null { return (r => r && r.cell(this.columnId))(this.quickTable.row(row, isHead)); }

    headerCell(row: number | RowId): Cell | null { return this.cell(row, true); }

    cellId(row: number | RowId, isHead: boolean = false): CellId { return cellId(row, this.columnId, isHead); }

    get headerCellIds(): CellId[] { return _.map(_.range(this.quickTable.headerRowCount), r => this.cellId(r, true)); }

    get bodyCellIds(): CellId[] { return _.map(_.range(this.quickTable.rowCount), r => this.cellId(r, false)); }

    get cellIds(): CellId[] { return _.concat([], this.headerCellIds, this.bodyCellIds); }

    get headerCells(): Cells { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }

    get bodyCells(): Cells { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }

    get cells(): Cells { return Cells[_makeInstance](this.quickTable, this.cellIds); }
}

export class Columns extends QTIterable<Column> {
    private constructor(readonly quickTable: QuickTable, readonly columnIds: ColumnId[]) {
        super();
        this.getter = c => c.columns;
    }

    static [_makeInstance](quickTable: QuickTable, columnIds: ColumnId[]): Columns { return new Columns(quickTable, columnIds); }

    get columns(): Column[] { return _.filter(_.map(this.columnIds, c => this.quickTable.column(c))) as Column[]; }

    get $head(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column) => col.add(c.$head), $()); }

    get $body(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column) => col.add(c.$body), $()); }

    get $(): JQuery { return _.reduce(this.columns, (col: JQuery, c: Column) => col.add(c.$), $()); }

    get headerCellIds(): CellId[] { return _.flatMap(this.columns, c => c.headerCellIds); }

    get bodyCellIds(): CellId[] { return _.flatMap(this.columns, c => c.bodyCellIds); }

    get cellIds(): CellId[] { return _.flatMap(this.columns, c => c.cellIds); }

    get headerCells(): Cells { return Cells[_makeInstance](this.quickTable, this.headerCellIds); }

    get bodyCells(): Cells { return Cells[_makeInstance](this.quickTable, this.bodyCellIds); }

    get cells(): Cells { return Cells[_makeInstance](this.quickTable, this.cellIds); }

    set visible(visible: boolean) { this.each(c => c.visible = visible); }

    get length(): number { return this.columnIds.length; }

    rowCells(row: number | RowId, isHead: boolean = false): Cells { return Cells[_makeInstance](this.quickTable, _.map(this.columns, c => c.cellId(row, isHead))); }

    headerRowCells(row: number | RowId): Cells { return this.rowCells(row, true); }
}

export class Row {
    private _cells: Map<Cell> = {};
    private constructor(readonly quickTable: QuickTable, readonly rowId: RowId) { }

    static [_makeInstance](quickTable: QuickTable, rowId: RowId): Row { return new Row(quickTable, rowId); }

    get isHead(): boolean { return this.rowId.isHead; }

    get index(): number { return this.rowId.rowIndex; }

    get $(): JQuery { return this.quickTable.getSection(this.isHead).find('tr').eq(this.index); }

    get $cells(): JQuery { return this.$.find('th,td'); }

    cell(column: number | ColumnId): Cell | null {
        column = columnId(column);
        if (!_.inRange(column.columnIndex, this.length)) { return null; }
        if (!(this._cells[String(column)] instanceof Cell)) {
            this._cells[String(column)] = Cell[_makeInstance](this.quickTable, this.cellId(column));
        }
        return this._cells[String(column)];
    }

    cellId(column: number | ColumnId): CellId { return cellId(this.rowId, column); }

    get cellIds(): CellId[] { return _.map(_.range(this.length), i => this.cellId(i)); }

    get cells(): Cells { return Cells[_makeInstance](this.quickTable, this.cellIds); }

    get length(): number { return this.$cells.length; }

    get cellHtmlData(): string[] { return this.cells.htmlData; }

    get cellTextData(): string[] { return this.cells.textData; }

    get data(): string[] | Object {
        if (this.quickTable.rawData && this.quickTable.rawData.length > this.index) {
            return this.quickTable.rawData[this.index];
        }
        return this.cellHtmlData;
    }
}

export class Rows extends QTIterable<Row> {
    private constructor(readonly quickTable: QuickTable, readonly rowIds: RowId[]) {
        super();
        this.getter = r => r.rows;
    }

    static [_makeInstance](quickTable: QuickTable, rowIds: RowId[]): Rows { return new Rows(quickTable, rowIds); }

    get rows(): Row[] { return _.filter(_.map(this.rowIds, r => this.quickTable.row(r))) as Row[]; }

    get $(): JQuery { return $(_.map(this.rows, r => r.$)); }

    get $cells(): JQuery { return $(_.map(this.rows, r => r.$cells)); }

    get length(): number { return this.rowIds.length; }

    columnCellIds(column: number | ColumnId): CellId[] { return _.map(this.rows, r => r.cellId(column)); }

    columnCells(column: number | ColumnId): Cells { return Cells[_makeInstance](this.quickTable, this.columnCellIds(column)); }

    get cellIds(): CellId[] { return _.flatMap(this.rows, r => r.cellIds); }

    get cells(): Cells { return Cells[_makeInstance](this.quickTable, this.cellIds); }

    get cellHtmlData(): String[][] { return _.map(this.rows, r => r.cellHtmlData); }

    get cellTextData(): String[][] { return _.map(this.rows, r => r.cellTextData); }

    get data(): (String[] | Object)[] { return _.map(this.rows, r => r.data); }
}

export class QuickTable extends EventEmitter {
    private readonly _table: JQuery;
    private readonly _columns: Map<Column> = {};
    private readonly _rows: Map<Row> = {};
    private _columnDefs: ColumnDef[] = []
    private _data: (String[] | Object)[] = [];
    autoDraw: boolean = true;
    id: any = null;
    private _inInit: boolean = false;
    private constructor(table: JQuery, initFunc: ((table: QuickTable) => void) | null = null) {
        super();
        this._table = $(table);
        if (initFunc && typeof initFunc == 'function') {
            this._inInit = true;
            initFunc(this);
            this._inInit = false;
        }
    }

    static [_makeInstance](table: JQuery, initFunc: ((table: QuickTable) => void) | null = null): QuickTable { return new QuickTable(table, initFunc); }

    chain(func: (table: this) => void): this {
        func(this);
        return this;
    }

    get $(): JQuery { return this._table; }

    getSection(isHead: boolean): JQuery { return this.$.find(isHead ? 'thead' : 'tbody'); }

    get $head(): JQuery { return this.getSection(true); }

    get $body(): JQuery { return this.getSection(false); }

    get columnCount(): number { return this.$.find('tr').eq(0).find('th,td').length; }

    get columns(): Columns { return Columns[_makeInstance](this, this.columnIds); }

    get columnIds(): ColumnId[] { return _.map(_.range(this.columnCount), i => this.columnId(i)); }

    column(column: number | ColumnId): Column | null {
        column = columnId(column);
        if (!_.inRange(column.columnIndex, this.columnCount)) { return null; }
        if (!(this._columns[String(column)] instanceof Column)) {
            this._columns[String(column)] = Column[_makeInstance](this, column);
        }
        return this._columns[String(column)];
    }

    columnId(column: number | ColumnId): ColumnId { return columnId(column); }

    getColumns(...columns: (number | ColumnId)[]): Columns { return Columns[_makeInstance](this, _.map(_.flatten(columns), c => this.columnId(c))); }

    getRowCount(isHead: boolean): number { return this[isHead ? '$head' : '$body'].find('tr').length }

    get rowCount(): number { return this.getRowCount(false); }

    get headerRowCount(): number { return this.getRowCount(true); }

    getAllRows(isHead: boolean): Rows { return Rows[_makeInstance](this, this.getAllRowIds(isHead)); }

    getAllRowIds(isHead: boolean): RowId[] { return _.map(_.range(this.getRowCount(isHead)), i => this.rowId(i, isHead)); }

    get rows(): Rows { return this.getAllRows(false); }

    get headerRows(): Rows { return this.getAllRows(true); }

    get rowIds(): RowId[] { return this.getAllRowIds(false); }

    get headerRowIds(): RowId[] { return this.getAllRowIds(true); }

    getBodyRows(...rows: (number | RowId)[]): Rows { return Rows[_makeInstance](this, _.map(_.flatten(rows), r => this.rowId(r, false))); }

    getHeaderRows(...rows: (number | RowId)[]): Rows { return Rows[_makeInstance](this, _.map(_.flatten(rows), r => this.rowId(r, true))); }

    getRows(...rowIds: RowId[]): Rows { return Rows[_makeInstance](this, _.filter(_.flatten(rowIds), r => r instanceof RowId)); }

    row(row: number | RowId, isHead: boolean = false): Row | null {
        row = rowId(row, isHead);
        if (!_.inRange(row.rowIndex, this.getRowCount(row.isHead))) { return null; }
        if (!(this._rows[String(row)] instanceof Row)) {
            this._rows[String(row)] = Row[_makeInstance](this, row);
        }
        return this._rows[String(row)];
    }

    rowId(row: number | RowId, isHead: boolean = false): RowId { return rowId(row, isHead); }

    headerRow(row: number | RowId): Row | null { return this.row(row, true); }

    headerRowId(row: number | RowId): RowId { return this.rowId(row, true); }

    cell(row: number | RowId | CellId, column: number | ColumnId = 0, isHead: boolean = false): Cell | null {
        let cell: CellId = cellId(row, column, isHead);
        return (r => r && r.cell(cell.columnId))(this.row(cell.rowId));
    }

    headerCell(row: number | RowId, column: number | ColumnId): Cell | null { return this.cell(row, column, true); }

    get columnDefs(): ColumnDef[] { return this._columnDefs; }

    set columnDefs(columnDefs: ColumnDef[]) {
        if (columnDefs.length < this.columnCount) {
            throw `Not enough columnDefs have been provided. Have ${this.columnCount} columns, but only ${columnDefs.length} columnDefs.`;
        }
        this._columnDefs = columnDefs;
        if (this.autoDraw && this._data && this._data.length > 0) {
            this.draw();
        }
    }

    get rawData(): (String[] | Object)[] { return this._data; }

    get data(): (String[] | Object)[] | null {
        if (this._data && this._data.length > 0) {
            return this._data;
        }
        return this.cellTextData;
    }

    get cellHtmlData(): String[][] { return this.rows.cellHtmlData; }
    get cellTextData(): String[][] { return this.rows.cellTextData; }

    set data(data: (String[] | Object)[] | null) {
        if (!data || data.length == 0) {
            this._data = [];
            if (this.autoDraw) { this.draw(); }
            return;
        }
        if (!_.isArray(data)) {
            throw 'data must be an array';
        }
        let colCount: number = this.columnCount;
        let colDefCount: number = this.columnDefs ? this.columnDefs.length : 0;
        if (colDefCount == 0) {
            if (_.some(data, d => !_.isArray(d))) {
                throw 'You must provide the data rows as arrays when columnDefs has not been set';
            }
            let minSize: number = _.min(_.map(data, d => (d as String[]).length)) || 0;
            if (minSize < colCount) {
                throw `One or more data rows had a size below the column count of ${colCount}. Minimum data row size: ${minSize}`;
            }
            this._data = data;
            if (this.autoDraw) { this.draw(); }
        } else if (colDefCount < colCount) {
            throw `Not enough columnDefs have been provided. Have ${colCount} columns, but only ${colDefCount} columnDefs.`;
        } else {
            this._data = data;
            if (this.autoDraw) { this.draw(); }
        }
    }

    draw(): this {
        if (this._inInit) { return this; }
        let $body: JQuery = this.$body;
        $body.empty();
        if (!this._data || this._data.length == 0) {
            return this.trigger('draw.empty');
        }
        let colDefs: ColumnDef[] = this.columnDefs;
        let colCount: number = this.columnCount;
        if (!colDefs || colDefs.length == 0) {
            // rows are arrays
            _.each(this._data, d => {
                let $row: JQuery = $('<tr>');
                for (let i = 0; i < colCount; i++) {
                    let $cell: JQuery = $('<td>');
                    $cell.text((d as string[])[i]);
                    $row.append($cell);
                }
                $body.append($row);
            });
        } else {
            // rows use columnDefs
            _.each(this._data, d => {
                let $row = $('<tr>')
                for (let i = 0; i < colCount; i++) {
                    let def: ColumnDef = colDefs[i];
                    let $cell: JQuery;
                    if (def.cellType == 'th') {
                        $cell = $('<th>');
                    } else {
                        $cell = $('<td>');
                    }
                    let fieldData: any = null;
                    if (def.data) {
                        fieldData = (d as Map<any>)[def.data];
                    }
                    if (typeof def.render == 'function') {
                        fieldData = def.render(fieldData, d);
                    }
                    if (fieldData) {
                        if (def.html) {
                            $cell.html(fieldData);
                        } else {
                            $cell.text(fieldData);
                        }
                    }
                    if (def.cssClass) {
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

const _addTable = Symbol('addTable');

export class QuickTables extends QTIterable<QuickTable> {
    private _tables: QuickTable[] = [];
    private constructor(tables: QuickTable[] = []) {
        super();
        this.getter = t => t.tables;
        this._tables = tables;
    }

    static [_makeInstance](tables: QuickTable[] = []): QuickTables { return new QuickTables(tables); }

    get tables(): QuickTable[] { return _.clone(this._tables); }

    get length(): number { return this._tables.length; }

    get(index: number): QuickTable { return this._tables[index]; }

    getById(id: any): QuickTable | undefined { return this.find(t => t.id == id); }

    getAll(...indexes: number[]): QuickTables { return new QuickTables(_.filter(_.map(indexes, i => this.get(i)))); }

    getAllById(...ids: any[]): QuickTables { return new QuickTables(_.filter(_.map(ids, i => this.getById(i))) as QuickTable[]); }

    [_addTable](table: QuickTable): void {
        if (table instanceof QuickTable) {
            this._tables.push(table);
        }
    }

    draw(): this { return this.each(t => t.draw()); }
}

export function setup(jquery: JQuery, lodash: LoDashStatic) {
    $ = jquery;
    _ = lodash;
    $.fn.QuickTable = function (initFunc: ((table: QuickTable) => void) | null = null): QuickTable | QuickTables {
        let tables: QuickTables = QuickTables[_makeInstance]();
        this.filter('table').each(function (this: any) {
            const $this: JQuery = $(this);
            let table: QuickTable | null = $this.data('quickTable');
            if (!table) {
                table = QuickTable[_makeInstance]($this, initFunc);
                $this.data('quickTable', table);
            }
            tables[_addTable](table);
        });
        if (tables.length == 1) {
            return tables.get(0);
        }
        return tables;
    }

    $.fn.QuickTable.columnId = columnId;
    $.fn.QuickTable.rowId = rowId;
    $.fn.QuickTable.cellId = cellId;
}