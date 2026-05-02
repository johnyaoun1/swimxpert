import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Pipe({ name: 'monthName', standalone: true })
export class MonthNamePipe implements PipeTransform {
  transform(value: string): string {
    const n = parseInt(value, 10);
    return MONTHS[n - 1] ?? value;
  }
}
