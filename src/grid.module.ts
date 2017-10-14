import { NgModule } from '@angular/core';
import { DGridContainerDirective } from './grid-container.directive';
import { DGridRowDirective } from './grid-row.directive';
import { DGridCellDirective } from './grid-cell.directive';

@NgModule({
    declarations:     [ DGridContainerDirective, DGridRowDirective, DGridCellDirective ],
    exports:          [ DGridContainerDirective, DGridRowDirective, DGridCellDirective ]
  
})
export class DGridModule {}