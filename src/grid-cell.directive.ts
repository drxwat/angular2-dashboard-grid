import { Directive, Renderer2, ElementRef, ViewChild, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { DGridRowDirective } from './grid-row.directive';
import { GridCellConfig, GridCellMDownEventMeta, OutCellResizeEvent } from './grid.interfaces';

/**
 * A grid cell that provides an API for managing its own size 
 * and also marks mouse events (MouseEvent) so that the top knows where the event came from
 * and whether it should be handled.
 */
@Directive({
    selector: '[gridCell]',
    inputs: ['config: gridCell'],
    host: {
        '(mousedown)': 'mouseDownEventHandler($event)',
        '(mouseup)': 'mouseUpEventHandler($event)'
    }
})
export class DGridCellDirective implements OnInit, OnDestroy {

    @Output() onResizing: EventEmitter<OutCellResizeEvent> = new EventEmitter<OutCellResizeEvent>()

    /* Only once configurable properties */
    public id: string
    public resizeHandleSelector: string
    public dragHandleSelector: string

    private _config: GridCellConfig
    private _initialized: boolean = false

    constructor(private _renderer: Renderer2, public _el: ElementRef, public gridRow: DGridRowDirective) { }

    ngOnInit() {
        this.gridRow.registerCell(this)
        this._initialized = true
    }

    ngOnDestroy() {
        this.gridRow.unregisterCell(this)
    }

    /* Getters/Setters */

    set config(config: GridCellConfig) {
        this._config = config

        this.id = config.id
        this.resizeHandleSelector = config.resizeHandleSelector
        this.dragHandleSelector = config.dragHandleSelector
    }

    get config(): GridCellConfig {
        return this._config
    }

    get width(): number {
        return this._config.width
    }

    set width(w: number) {
        this._config.width = w
    }

    get height(): number {
        return this._config.height
    }

    set height(h: number) {
        this._config.height = h
    }

    /**
     * Sets cell size in pixels
     * @param width 
     * @param height 
     */
    public setSize(width: number, height: number) {
        this.setWidth(width)
        this.setHeight(height)
        this.onResizing.emit({ id: this.id, width: width, height: height })
    }

    /**
     * Recalculates cell size and sets it in pixels. Emits onResize EVENT
     */
    public applySize() {
        this.gridRow.applyCellSize(this)
    }

    public isResizeHandleOwner(event: MouseEvent): boolean {
        return this.elementMatches(event.target, this.resizeHandleSelector)
    }

    /* MouseEvents */

    public mouseDownEventHandler(event: MouseEvent) {
        if (event.which != 1) {
            return
        }

        if (this.elementMatches(event.target, this.resizeHandleSelector)) {
            event['gridMeta'] = <GridCellMDownEventMeta>{
                handleType: 'resize',
                cellId: this.id,
                elMeta: {
                    startX: event.clientX,
                    startY: event.clientY,
                    startWidth: parseInt(document.defaultView.getComputedStyle(this._el.nativeElement).width, 10),
                    startHeight: parseInt(document.defaultView.getComputedStyle(this._el.nativeElement).height, 10)
                }
            }
        } else if (this.elementMatches(event.target, this.dragHandleSelector)) {
            event['gridMeta'] = <GridCellMDownEventMeta>{
                handleType: 'drag',
                cellId: this.id,
                elMeta: {
                    startX: event.pageX,
                    startY: event.pageY
                }
            }
        }
    }

    public mouseUpEventHandler(event: MouseEvent) {
        if (event.which != 1) {
            return
        }
        event['gridMeta'] = {
            cellId: this.id
        }
    }

    /* Helpers */

    private setHeight(height: number) {
        this.setNativeCellStyle('height', height + 'px')
    }

    private setWidth(width: number) {
        this.setNativeCellStyle('width', width + 'px')
    }

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

    private setNativeCellStyle(style: string, value: any) {
        this._renderer.setStyle(this._el.nativeElement, style, value)
    }
}