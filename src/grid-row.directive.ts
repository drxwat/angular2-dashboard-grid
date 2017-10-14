import { Directive, ElementRef, Renderer2, OnInit, OnDestroy, DoCheck, Output, EventEmitter } from '@angular/core';
import { DGridCellDirective } from './grid-cell.directive';
import { GridRowConfig, GridCellMDownEventMeta, CellResizeEvent, CellDragEvent, OutCellResizeEvent, OutRowEmptyClickEvent } from './grid.interfaces';
import { DGridContainerDirective } from './grid-container.directive';
import { isNullOrUndefined } from 'util';

/**
 * Строка сетки(grid), которая полностью управляет ресайзом содержащихся в ней ячеек(cell) 
 */
@Directive({
    selector: '[gridRow]',
    inputs: ['config: gridRow'],
    host: {
        '(mousedown)': 'mouseDownEventHandler($event)',
        '(document:mousemove)': 'mouseMoveEventHandler($event)',
        '(document:mouseup)': 'mouseUpEventHandler($event)',
    }
})
export class DGridRowDirective implements OnInit, OnDestroy, DoCheck {

    @Output() onResizeStart: EventEmitter<OutCellResizeEvent> = new EventEmitter<OutCellResizeEvent>()
    @Output() onResizeEnd: EventEmitter<OutCellResizeEvent> = new EventEmitter<OutCellResizeEvent>()
    @Output() onEmptyClick: EventEmitter<OutRowEmptyClickEvent> = new EventEmitter<OutRowEmptyClickEvent>()
    @Output() onEmptyMouseIn: EventEmitter<any> = new EventEmitter<any>()
    @Output() onEmptyMouseOut: EventEmitter<any> = new EventEmitter<any>()

    
    /* Only once configurable properties */
    public id: string
    public width: number
    public minCellHeight: number
    public minCellWidth: number
    public emptySpaceThreshold: number
    public unifyHeight: boolean

    /* Cells */
    private _cellsLength: number = 0
    private _gridUnitSize: number
    private _cells: DGridCellDirective[] = []
    private _emptySpaceId: string
    private _emptySpace: any
    private _emptySpaceStartWidth: number// in pixels // Что бы лишний раз не делать запросы к DOM будем полагать, что наши изменения размеров всегда работают как положено =)
    private _resizingData: {
        cell: DGridCellDirective,
        meta: CellResizeEvent
    }
    private _lastCell: DGridCellDirective
    private _gluedLastCell: boolean = false

    private _config: GridRowConfig //ngModel

    constructor(private _renderer: Renderer2, private _el: ElementRef, private _grid: DGridContainerDirective) { }

    ngOnInit() {
        this._grid.registerRow(this)

        this._emptySpace = this._renderer.createElement('div')
        this._emptySpaceId = Math.random().toString(36).substr(2, 10)

        this._renderer.listen(this._emptySpace, 'mouseup', event => {
            if (event.which != 1) {
                return
            }
            event['gridMeta'] = {
                cellId: this._emptySpaceId
            }
        })
        this._renderer.listen(this._emptySpace, 'click', event => {
            if (event.which != 1) {
                return
            }
            this.onEmptyClick.emit({
                id: this.id,
                widthU: this.pixelsToGridUnits(this.getEmptySpaceWidth()),
                heightU: this.height
            })
        })
        
        this._renderer.listen(this._emptySpace, 'mouseover', event => {
            this.onEmptyMouseIn.emit(this._emptySpace)
        })
        this._renderer.listen(this._emptySpace, 'mouseout', event => {
            this.onEmptyMouseOut.emit(this._emptySpace)
        })

        this._renderer.addClass(this._emptySpace, 'grid-row-empty-space')
        this._renderer.appendChild(this._el.nativeElement, this._emptySpace)

        let esText = this._renderer.createElement('div')
        this._renderer.appendChild(esText, this._renderer.createText('Empty Space'))
        this._renderer.appendChild(this._emptySpace, esText)

        this.recalculateEmptySpace()
        if(this._cells.length === 0){ this.applyHeight() }
    }

    ngOnDestroy() {
        this._grid.removeRow(this)
    }

    /**
     * Чуть менее примитивный детектор, котрый проверят кол-во ячеек в строке и пересчитывает пустое место
     * В результате при drag&drop происходит пересчет
     */
    ngDoCheck() {
        if (this._cellsLength !== this._cells.length) {
            this._cellsLength = this._cells.length
            this._cells.forEach(cell => this.applyCellSize(cell))
            this.recalculateEmptySpace()
        }
    }

    set config(config: GridRowConfig) {
        this._config = config

        this.id = config.id
        this.width = config.width
        this.minCellHeight = config.minCellHeight
        this.minCellWidth = config.minCellWidth
        this.emptySpaceThreshold = config.emptySpaceThreshold ? config.emptySpaceThreshold : 0
        this.unifyHeight = isNullOrUndefined(config.unifyHeight) ? true : config.unifyHeight
    }

    get config(): GridRowConfig {
        return this._config
    }

    get height(): number {
        return this._config.height
    }

    set height(h: number) {
        this._config.height = h
    }

    /** Cells API */

    public getCellById(id: string): DGridCellDirective {
        return this._cells.find(cell => cell.id == id)
    }

    public registerCell(cell: DGridCellDirective) {
        this._cells.push(cell)
        if (!cell.gridRow || cell.gridRow.id !== this.id) {
            cell.gridRow = this
        }
        if (this.unifyHeight && this._cells.length != 1) {
            cell.height = this._cells[0].height
        } else {
            cell.height = this.height
        }
    }

    public unregisterCell(cell: DGridCellDirective) {
        let i = this._cells.findIndex(gridCell => gridCell.id === cell.id)
        if (!isNullOrUndefined(i)) {
            this._cells[i].gridRow = undefined
            this._cells.splice(Number(i), 1)
        }
    }

    public addClassToCells(cls: string, toEmpty: boolean = true) {
        this._cells.forEach(cell => this._renderer.addClass(cell._el.nativeElement, cls))
        if (toEmpty) {
            this._renderer.addClass(this._emptySpace, cls)
        }
    }

    public removeClassFromCells(cls: string, fromEmpty: boolean = true) {
        this._cells.forEach(cell => this._renderer.removeClass(cell._el.nativeElement, cls))
        if (fromEmpty) {
            this._renderer.removeClass(this._emptySpace, cls)
        }
    }

    public getEmptySpaceId(): string {
        return this._emptySpaceId
    }

    /** DOM Events **/

    /**
     * Инициализируем данные для обработки событий resize/drag
     */
    public mouseDownEventHandler(event: any) {
        if (event.gridMeta) {
            let meta = <GridCellMDownEventMeta>event.gridMeta
            let cell = this._cells.find(cell => cell.id == meta.cellId)

            if (meta.handleType === 'resize') {
                this._resizingData = {
                    cell: cell,
                    meta: <CellResizeEvent>meta.elMeta
                }
                this._lastCell = this._cells.find(cell => cell.id === this._grid.getRowsLastCellId(this.id))
                this._emptySpaceStartWidth = this.getEmptySpaceWidth()
                this.onResizeStart.emit(this.getOutputResizingEvent())
            }
        }
    }

    /**
     * Обрабатываем события resize/drop
     */
    public mouseMoveEventHandler(event: MouseEvent) {
        if (this._resizingData) {
            this.processResize(event)
        }
    }

    /**
     * Завершаем обработку событий resize/drag
     */
    public mouseUpEventHandler(event: any) {
        // Подтягиваем все ячейки под одну высоту
        if (this._resizingData) {
            if (this.unifyHeight) {
                this.unifyHeightByCell(this._resizingData.cell)
            }
            this.recalculateEmptySpace()
            this.onResizeEnd.emit(this.getOutputResizingEvent())
        }
        this._lastCell = undefined
        this._resizingData = undefined
    }

    /**
     * Устанавливает размер ячейки в пикселях в зависимости от заданного в ней размера в относительных ядиницах
     * @param cell 
     */
    public applyCellSize(cell: DGridCellDirective) {
        cell.setSize(this.gridUnitsToPixels(cell.width), this.gridUnitsToPixels(cell.height))
        this.height = cell.height
        this.applyHeight()
    }

    /**Helpers */

    private recalculateEmptySpace() {
        let occupied = this._cells.map(cell => cell.width).reduce((acc, cellWidth) => acc + cellWidth, 0) // Расчитываем ширину в юнитах
        let newWidth = this.gridUnitsToPixels(this.width - occupied)
        this.setEmptySpaceWidth(newWidth)
        if(this.pixelsToGridUnits(newWidth) <= this.emptySpaceThreshold){
            this._gluedLastCell = true
        }else{
            this._gluedLastCell = false
        }
    }

    private unifyHeightByCell(cell: DGridCellDirective) {
        let uniH = cell.height

        this._cells.forEach(cell => {
            cell.height = uniH
            this.applyCellSize(cell)
        })
        this.height = uniH
        this.applyHeight()
    }

    private applyHeight() {
        this._renderer.setStyle(this._el.nativeElement, 'height', this.gridUnitsToPixels(this.height) + 'px')
    }

    private processResize(event: MouseEvent) {
        let deltaW = event.clientX - this._resizingData.meta.startX
        let deltaH = event.clientY - this._resizingData.meta.startY

        let newUniW = this.pixelsToGridUnits(this._resizingData.meta.startWidth + deltaW)
        let newUniH = this.pixelsToGridUnits(this._resizingData.meta.startHeight + deltaH)

        newUniW = newUniW <= this.minCellWidth ? this.minCellWidth : newUniW

        let oldUniW = this._resizingData.cell.width
        // Ширина пустого места
        let newESWidth = this._emptySpaceStartWidth - deltaW

        let isResizingGluedCell = this._gluedLastCell && this._resizingData.cell.id === this._lastCell.id

        if (
            (!this._gluedLastCell && this.pixelsToGridUnits(newESWidth) > this.emptySpaceThreshold)
            || isResizingGluedCell
        ) { // Изменяем ячекйку вместе с пустым местом
            
            // Отлепляем ячеку
            if (isResizingGluedCell && this.pixelsToGridUnits(newESWidth) > this.emptySpaceThreshold) {
                this._gluedLastCell = false
            }
            
            if(!this._gluedLastCell){
                this._resizingData.cell.width = newUniW                
            }
            
        } else { // Убираем пустое место
            this._gluedLastCell = true // Прилепляем ячейку

            if (this._lastCell.id === this._resizingData.cell.id) { // Ресайзим самую правую ячейку
                // Расширяем блок на максимум
                let occupiedUniW = this._cells.map(cell => cell.width).reduce((acc, cellWidth) => acc + cellWidth, 0)
                let maxUniW = this._resizingData.cell.width + this.width - occupiedUniW
                this._resizingData.cell.width = maxUniW
            } else { // Изменяем ячекйку вместе с самой правой ячейкой
                this._resizingData.cell.width = newUniW
                // Расширяем правую ячейку на всю оставшуюся ширину
                let occupiedUniW = this._cells.map(cell => cell.width).reduce((acc, cellWidth) => acc + cellWidth, 0)
                let maxUniW = this._lastCell.width + this.width - occupiedUniW
                
                if(maxUniW <= this.minCellWidth){ // Самая праввя ячейка уперлась по ширине
                    this._resizingData.cell.width = this._resizingData.cell.width - (this.minCellWidth - maxUniW)
                    maxUniW = this.minCellWidth
                }

                this._lastCell.width = maxUniW
                this.applyCellSize(this._lastCell)
            }
        }
        this._resizingData.cell.height = newUniH <= this.minCellHeight ? this.minCellHeight : newUniH
        this.applyCellSize(this._resizingData.cell)
        this.recalculateEmptySpace()
    }

    private getUnitSize(reusePrevious: boolean = false): number {
        if (reusePrevious) {
            if (!this._gridUnitSize) {
                this._gridUnitSize = parseInt(document.defaultView.getComputedStyle(this._el.nativeElement).width, 10) / this.width
            }
            return this._gridUnitSize
        }
        return parseInt(document.defaultView.getComputedStyle(this._el.nativeElement).width, 10) / this.width
    }

    private setEmptySpaceWidth(width: number) {
        this._renderer.setStyle(this._emptySpace, 'width', width + 'px')
    }

    private getEmptySpaceWidth(): number {
        return parseInt(document.defaultView.getComputedStyle(this._emptySpace).width, 10)
    }

    private gridUnitsToPixels(units: number): number {
        return Math.ceil(this.getUnitSize() * units)
    }

    private pixelsToGridUnits(pixels: number): number {
        return Math.ceil(pixels / this.getUnitSize())
    }

    private getOutputResizingEvent(): OutCellResizeEvent {
        return {
            id: this._resizingData.cell.id,
            width: this._resizingData.cell.width,
            height: this._resizingData.cell.height
        }
    }
}