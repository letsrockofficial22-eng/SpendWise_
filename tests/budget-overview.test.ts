import {describe,it,expect} from 'vitest';
import {budgetSpending,latestBudget} from '../lib/calculations';
import type {Budget,Transaction} from '../types';
import {setTimeZone} from '../lib/date-utils';

const budgets:Budget[]=[
  {id:'older',name:'Older budget',amount:500,period:'daily',createdAt:'2026-10-01T10:00:00.000Z'},
  {id:'newer',name:'Newer budget',amount:2000,period:'monthly',createdAt:'2026-10-02T10:00:00.000Z'},
];
const transactions:Transaction[]=[
  {id:'today-food',type:'expense',amount:40,category:'Food',paymentMethod:'cash',date:'2026-10-15T08:00:00.000Z'},
  {id:'today-transport',type:'expense',amount:25,category:'Transport',paymentMethod:'cash',date:'2026-10-15T09:00:00.000Z'},
  {id:'other-month',type:'expense',amount:70,category:'Food',paymentMethod:'cash',date:'2026-09-15T08:00:00.000Z'},
  {id:'later-this-month',type:'expense',amount:90,category:'Food',paymentMethod:'cash',date:'2026-10-20T08:00:00.000Z'},
  {id:'income',type:'income',amount:100,category:'Income',paymentMethod:'cash',date:'2026-10-15T10:00:00.000Z'},
  {id:'future',type:'expense',amount:100,category:'Food',paymentMethod:'cash',date:'2026-10-16T08:00:00.000Z'},
];

describe('overview budget selection',()=>{
  it('uses the most recently created budget and falls back to the last entry when timestamps are unavailable',()=>{
    expect(latestBudget(budgets)?.id).toBe('newer');
    expect(latestBudget([{...budgets[0],createdAt:undefined},{...budgets[1],createdAt:undefined}])?.id).toBe('newer');
    expect(latestBudget([])).toBeUndefined();
  });

  it('calculates spending for a daily category budget',()=>{
    setTimeZone('UTC');
    expect(budgetSpending({...budgets[0],category:'Food'},transactions,'2026-10-15',new Date('2026-10-15T12:00:00.000Z'))).toBe(40);
  });

  it('calculates spending for a monthly budget and excludes future transactions',()=>{
    setTimeZone('UTC');
    expect(budgetSpending(budgets[1],transactions,'2026-10-15',new Date('2026-10-31T12:00:00.000Z'))).toBe(65);
  });
});
