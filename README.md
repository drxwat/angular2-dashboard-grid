# angular2-dashboard-grid
flexible angular2 grid with drag&amp;drop and cell resizing

## Instalation


```
npm i angular2-dashboard-grid
```

And you need to add DGridModule to your module imports

```
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    DGridModule
  ],

 ...
```


## Usage

Exapmle [Demo repository](https://github.com/drxwat/angular-grid-dashboard-demo).


Demo [app](https://drxwat.github.io/).

How it looks in template:

```html
<div [(grid)]="gridConfig" (onDragEnd)="processDragEnd()">
    <div [gridRow]="rowConfig.row" *ngFor="let rowConfig of gridConfig" (onResizeEnd)="processResizeEnd($event)" (onEmptyClick)="processEmptyClick($event)" class="grid-row-wrapper noselect">
        <div [gridCell]="cellConf.cell" *ngFor="let cellConf of rowConfig.cells" (onResizing)="processResize($event)" class="grid-cell-wrapper">
            <div class="grid-cell-drag-handle"></div>
            <span class="grid-cell-resize-handle"></span>
        </div>
    </div>
</div>
```


## 




