export type GridConfig = [{ row: GridRowConfig, cells: {cell: GridCellConfig}[] }] // Grid config minimal interface

export interface GridCellConfig {
    id: string
    width: number
    height: number
    resizeHandleSelector: string
    dragHandleSelector: string

}
export interface GridRowConfig {
    id: string
    width: number
    height: number
    minCellHeight: number
    minCellWidth: number
    emptySpaceThreshold: number
    unifyHeight: boolean
}

/**
 * Public EVENTS
 */

/**
 * Contains cell data. Width & heigth in pixels
 */
export interface OutCellResizeEvent {
    id: string
    width: number
    height: number
}

/**
 * Contains empty space data. Width & heigth in grid units
 */
export interface OutRowEmptyClickEvent {
    id: string,
    widthU: number,
    heightU: number
}


/* Private EVENTS */
export interface GridCellMDownEventMeta {
    cellId: string
    handleType: string
    elMeta: CellResizeEvent | CellDragEvent
}

export interface GridCellMUpEventMeta {
    cellId: string
}

export interface CellResizeEvent {
    startX: number
    startY: number
    startWidth: number
    startHeight: number
}

export interface CellDragEvent {
    startX: number
    startY: number
}



