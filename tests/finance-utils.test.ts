import {describe,expect,it} from 'vitest';
import {advanceBillDate,localReminderTime,mergeUniqueById,monthBounds,nextBillDateAfter,sharedExpenseSummary,splitAmountEqually,transactionMatchesSearch} from '../lib/finance-utils';
import type {RecurringBill,SharedExpense,Transaction} from '../types';

describe('finance feature helpers',()=>{
  it('splits cents evenly without losing any money',()=>{
    const shares=splitAmountEqually(10,['Alex','Sam','Taylor']);
    expect(shares.map(share=>share.amount)).toEqual([3.34,3.33,3.33]);
    expect(shares.reduce((sum,share)=>sum+share.amount,0)).toBe(10);
  });

  it('advances weekly, monthly, and yearly bills across calendar boundaries',()=>{
    const monthly:RecurringBill={id:'bill',name:'Rent',amount:100,category:'Housing',frequency:'monthly',nextDue:'2026-01-31',reminder:true};
    expect(advanceBillDate(monthly)).toBe('2026-02-28');
    expect(advanceBillDate({...monthly,nextDue:'2024-02-29',frequency:'yearly'})).toBe('2025-02-28');
    expect(advanceBillDate({...monthly,nextDue:'2026-12-30',frequency:'weekly'})).toBe('2027-01-06');
    expect(nextBillDateAfter(monthly,'2026-03-01')).toBe('2026-03-31');
  });

  it('schedules a local reminder at 9am on the prior day only if it is upcoming',()=>{
    expect(localReminderTime('2026-11-06',new Date('2026-11-04T00:00:00'))?.getHours()).toBe(9);
    expect(localReminderTime('2026-11-05',new Date('2026-11-04T08:00:00'))?.getDate()).toBe(4);
    expect(localReminderTime('2026-11-05',new Date('2026-11-04T08:00:00'))?.getHours()).toBe(9);
    expect(localReminderTime('2026-11-04',new Date('2026-11-04T10:00:00'))).toBeUndefined();
  });

  it('searches transaction categories, notes, descriptions, subcategories, and payment methods',()=>{
    const transaction:Transaction={id:'tx',type:'expense',amount:25,category:'Food',subcategory:'Lunch',description:'Rice',notes:'With class',paymentMethod:'bkash',date:'2026-11-01T10:00:00Z'};
    expect(transactionMatchesSearch(transaction,'CLASS')).toBe(true);
    expect(transactionMatchesSearch(transaction,'bkash')).toBe(true);
    expect(transactionMatchesSearch(transaction,'transport')).toBe(false);
  });

  it('uses calendar month bounds and reports only unsettled shared amounts as owed',()=>{
    expect(monthBounds('2024-02')).toEqual({start:'2024-02-01',end:'2024-02-29'});
    const shared:SharedExpense={id:'shared',title:'Dinner',total:30,paidBy:'Me',shares:[{name:'Alex',amount:10,settled:true},{name:'Sam',amount:10,settled:false}],createdAt:'2026-11-04'};
    expect(sharedExpenseSummary(shared)).toEqual({total:30,settled:10,outstanding:10});
  });

  it('merges records without replacing existing IDs',()=>{
    expect(mergeUniqueById([{id:'one',value:1}],[{id:'one',value:2},{id:'two',value:3}])).toEqual([{id:'one',value:1},{id:'two',value:3}]);
  });
});
