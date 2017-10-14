import { Directive, Renderer2, ElementRef, OnChanges, SimpleChanges, EventEmitter, Output } from '@angular/core';
import { DGridCellDirective } from './grid-cell.directive';
import { DGridRowDirective } from './grid-row.directive';
import { CellDragEvent, GridCellMUpEventMeta, GridCellMDownEventMeta, GridConfig } from './grid.interfaces';
import { isNullOrUndefined } from 'util';

/**
 * The grid container. Contains rows of the grid and controls the movement of cells from one line to another.
 */
@Directive({
    selector: '[grid]',
    inputs: ['config: grid'],
    host: {
        '(mousedown)': 'mouseDownEventHandler($event)',
        '(document:mousemove)': 'mouseMoveEventHandler($event)',
        '(document:mouseup)': 'mouseUpEventHandler($event)'
    }
})
export class DGridContainerDirective {

    private _config: GridConfig

    @Output() onDragStart: EventEmitter<string> = new EventEmitter() // todo: realize 
    @Output() onDraging: EventEmitter<string> = new EventEmitter() // todo: realize
    @Output() onDragEnd: EventEmitter<string> = new EventEmitter()

    private _rows: DGridRowDirective[] = []
    private _dragingData: {
        cell: DGridCellDirective,
        row: DGridRowDirective
        meta: CellDragEvent,
        avatar?: any,
        shift?: {
            left: number
            top: number
        }
    }
    private _dragSensabilityThreshold: number = 5 // in pixels. todo: Move to config
    private _dropableClass = 'grid-dropable' // Hardcoded in GridCellDirective. todo: centralize
    private _hgClass = 'highlighted-dropable'
    private _highlitedDropable: any

    public constructor(private _renderer: Renderer2, private _el: ElementRef) { }

    set config(config: GridConfig) {
        this._config = config
    }

    get config(): GridConfig {
        return this._config
    }

    /** 
     * Rows API
     */

    public registerRow(row: DGridRowDirective) {
        this._rows.push(row)
    }

    public removeRow(row: DGridRowDirective) {
        let i = this._rows.findIndex(gridRow => gridRow == row)
        if (!isNullOrUndefined(i)) { this._rows.slice(Number(i), 1) }
    }

    /**
     * Returns id of last cell in row or null for empty row
     * @param rowId 
     */
    public getRowsLastCellId(rowId: string): string {
        let rowConf = this._config.find(rowConf => rowConf.row.id === rowId)
        if(rowConf.cells.length > 0){
            return rowConf.cells[rowConf.cells.length - 1].cell.id
        }
        return null
    }

    /**
     * Returns id of first cell in row or null for empty row
     * @param rowId 
     */
    public getRowsFirstCellID(rowId: string): string {
        let rowConf = this._config.find(rowConf => rowConf.row.id === rowId)
        if(rowConf.cells.length > 0){
            return rowConf.cells[0].cell.id
        }
        return null
    }

    /** DOM events(drag&drop) */

    public mouseDownEventHandler(event: any) {
        if (event.gridMeta && event.gridMeta.handleType === 'drag') {
            let meta = <GridCellMDownEventMeta>event.gridMeta
            let dragMeta = <CellDragEvent>meta.elMeta

            let cell, row
            for (let rw of this._rows) {
                let cl = rw.getCellById(meta.cellId)
                if (cl) {
                    row = rw
                    cell = cl
                }
            }

            this._dragingData = {
                cell: cell,
                row: row,
                meta: <CellDragEvent>meta.elMeta
            }
        }
    }

    public mouseMoveEventHandler(event: MouseEvent) {
        if (this._dragingData) {
            if (!this._dragingData.avatar) { // drag not started yet
                let moveX = this._dragingData.meta.startX - event.pageX
                let moveY = this._dragingData.meta.startY - event.pageY

                // We are protected from a tremor =)
                if (
                    Math.abs(moveX) < this._dragSensabilityThreshold &&
                    Math.abs(moveY) < this._dragSensabilityThreshold) {
                    return
                }
                let cell = this._dragingData.cell

                this._dragingData.avatar = cell._el.nativeElement.cloneNode(true)
                this._renderer.setStyle(this._dragingData.avatar, 'pointer-events', 'none') // Что бы не мешался сука

                let box = cell._el.nativeElement.getBoundingClientRect()
                let shiftX = event.pageX - box.left - pageXOffset
                let shiftY = event.pageY - box.top - pageYOffset

                this._dragingData.shift = {
                    left: shiftX,
                    top: shiftY
                }

                // Displaying drag start
                this._renderer.appendChild(document.body, this._dragingData.avatar)
                this._renderer.setStyle(this._dragingData.avatar, 'zIndex', 9999)
                this._renderer.setStyle(this._dragingData.avatar, 'position', 'absolute')
                this._renderer.setStyle(this._dragingData.avatar, 'opacity', '0.5')

                // Mark cell with css class
                this._rows.forEach(row => row.addClassToCells(this._dropableClass))
            }

            let dropable = this.findDropable(event.target)

            if (!isNullOrUndefined(dropable) && isNullOrUndefined(this._highlitedDropable)) {
                this._highlitedDropable = dropable
                this._renderer.addClass(this._highlitedDropable, this._hgClass)

            }

            if (!isNullOrUndefined(this._highlitedDropable) && dropable !== this._highlitedDropable) { // Element changed
                this._renderer.removeClass(this._highlitedDropable, this._hgClass)
                if (!isNullOrUndefined(dropable)) { // dropable changed
                    this._highlitedDropable = dropable
                    this._renderer.addClass(this._highlitedDropable, this._hgClass)
                }
            }

            this._renderer.setStyle(this._dragingData.avatar, 'left', event.pageX - this._dragingData.shift.left + 'px')
            this._renderer.setStyle(this._dragingData.avatar, 'top', event.pageY - this._dragingData.shift.top + 'px')

        }
    }

    public mouseUpEventHandler(event: any) {
        if (this._dragingData && this._dragingData.avatar) {
            if (event.gridMeta) {
                let meta = <GridCellMUpEventMeta>event.gridMeta

                let destCell, destRow
                let isEmptySpace = false
                for (let rw of this._rows) {
                    if (meta.cellId === rw.getEmptySpaceId()) {
                        isEmptySpace = true
                        destRow = rw
                    }
                    let cl = rw.getCellById(meta.cellId)
                    if (cl) {
                        destRow = rw
                        destCell = cl
                    }
                }
                if(isNullOrUndefined(destCell) || this._dragingData.cell.id !== destCell.id){
                    this.moveCell(this._dragingData.cell, this._dragingData.row, destRow, destCell)
                }
                this.onDragEnd.emit()
            }
            this._renderer.removeChild(this._dragingData.avatar.parentNode, this._dragingData.avatar)
            if (this._highlitedDropable) {
                this._renderer.removeClass(this._highlitedDropable, this._hgClass)
            }
            this._rows.forEach(row => row.removeClassFromCells(this._dropableClass))
        }

        this._dragingData = undefined
    }

    /**
     * todo: разобрать эту кучу дерьма. Запилить API для перемещения ячеек между строками и с помощью него переписать
     * @param cell - ячейка которая будет перемещена
     * @param fromRow - строка из которой будет перемещена ячейка
     * @param toRow - строка в которую будет перемещена ячейка
     * @param targetCell - целевая ячейка куда будет перемещена cell ячейка. Если не указано, то предполагается пустое место
     */
    private moveCell(cell: DGridCellDirective, fromRow: DGridRowDirective, toRow: DGridRowDirective, targetCell?: DGridCellDirective) {
        let fromRowConfig = this._config.find(rowCong => rowCong.row.id === fromRow.id)
        let toRowConfig = this._config.find(rowCong => rowCong.row.id === toRow.id)
        let cellConfIdx = fromRowConfig.cells.findIndex(cellConf => cellConf.cell.id === cell.id)

        let moovingCell = fromRowConfig.cells.splice(cellConfIdx, 1)[0] // Компонент ячейки уничтожается

        if (targetCell) {
            let targetIdx = toRowConfig.cells.findIndex(cellConf => cellConf.cell.id === targetCell.id)

            if (toRow.id === fromRow.id) { // Меняем местами
                toRowConfig.cells.splice(targetIdx + 1, 0, moovingCell)
                let moovingTargetCell = toRowConfig.cells.splice(targetIdx, 1)[0]
                toRowConfig.cells.splice(cellConfIdx, 0, moovingTargetCell)
            } else { // Пермещаем на целевую ячейку и делим ее ширину пополам
                let wholeWidth = toRowConfig.cells[targetIdx].cell.width
                let fHalfW = Math.round(wholeWidth / 2)
                let sHalfW = wholeWidth - fHalfW

                // Устанавливаем ширину ячеек
                toRowConfig.cells[targetIdx].cell.width = fHalfW // целевая
                moovingCell.cell.width = sHalfW // перемещаемая
                toRowConfig.cells.splice(targetIdx + 1, 0, moovingCell)
            }
        } else { // Перемещаем на пустое место
            if (toRow.id === fromRow.id) { // Кидем в конец не растягивая
                toRowConfig.cells.splice(toRowConfig.cells.length, 0, moovingCell)
            } else {
                let occupiedRowWidth = toRowConfig.cells.map(cell => cell.cell.width).reduce((acc, width) => acc + width, 0)
                moovingCell.cell.width = toRowConfig.row.width - occupiedRowWidth
                toRowConfig.cells.splice(toRowConfig.cells.length, 0, moovingCell)
            }
        }
    }

    private findDropable(startElement: any): any {
        try {
            let targetElem: any = startElement;

            while (targetElem && targetElem != this._el.nativeElement) {
                if (this.elementMatches(targetElem, '.' + this._dropableClass)) return targetElem;

                targetElem = targetElem.parentElement;
            }
        } catch (err) { }

        return null;
    }

    // todo: Дублируется в cell. Перенести в отдельный файл и экспортировать
    private elementMatches(element: any, selector: string): boolean {
        if (!element) return false;
        if (element.matches) return element.matches(selector);
        if (element.oMatchesSelector) return element.oMatchesSelector(selector);
        if (element.msMatchesSelector) return element.msMatchesSelector(selector);
        if (element.mozMatchesSelector) return element.mozMatchesSelector(selector);
        if (element.webkitMatchesSelector) return element.webkitMatchesSelector(selector);

        if (!element.document || !element.ownerDocument) return false;

        const matches: any = (element.document || element.ownerDocument).querySelectorAll(selector);
        let i: number = matches.length;
        while (--i >= 0 && matches.item(i) !== element) { }
        return i > -1;
    }
}