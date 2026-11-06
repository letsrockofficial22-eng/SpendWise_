import {Transaction,Budget,UserPreferences} from '../types'; import {localInput} from './date-utils';
export const categories=['Transport','Food & Drinks','Education','Mobile & Internet','Shopping','Personal Care','Entertainment','Cigarettes','Other'];
export const subcategories=['Bus','Rickshaw','CNG','Tea','Snacks','Lunch','Dinner','Photocopy','Mobile data','Cigarettes'];
const day=(offset:number,hour:number,minute=0)=>{const d=new Date();d.setDate(d.getDate()-offset);d.setHours(hour,minute,0,0);if(d>new Date())d.setHours(0,0,0,0);return localInput(d)};
export function mockTransactions():Transaction[]{return [
{id:'1',type:'expense',amount:40,category:'Transport',subcategory:'Bus',description:'Bus fare to campus',paymentMethod:'cash',date:day(0,9,15)},
{id:'2',type:'expense',amount:25,category:'Food & Drinks',subcategory:'Tea',description:'Morning tea & snacks',paymentMethod:'cash',date:day(0,10,30)},
{id:'3',type:'expense',amount:120,category:'Food & Drinks',subcategory:'Lunch',description:'Lunch at campus',paymentMethod:'bkash',date:day(0,12,45)},
{id:'4',type:'expense',amount:60,category:'Education',subcategory:'Photocopy',description:'Lecture notes',paymentMethod:'cash',date:day(1,14,10)},
{id:'5',type:'expense',amount:80,category:'Transport',subcategory:'Rickshaw',description:'Rickshaw ride',paymentMethod:'cash',date:day(1,17)},
{id:'6',type:'expense',amount:150,category:'Mobile & Internet',subcategory:'Mobile data',description:'Mobile data pack',paymentMethod:'bkash',date:day(2,11)},
{id:'7',type:'expense',amount:180,category:'Food & Drinks',subcategory:'Dinner',description:'Dinner with friends',paymentMethod:'nagad',date:day(3,19)},
{id:'8',type:'expense',amount:220,category:'Shopping',description:'Stationery essentials',paymentMethod:'cash',date:day(4,16)},
{id:'9',type:'expense',amount:45,category:'Food & Drinks',subcategory:'Snacks',description:'Afternoon snacks',paymentMethod:'cash',date:day(5,15)},
{id:'10',type:'income',amount:10000,category:'Pocket money',description:'Monthly pocket money',paymentMethod:'bank',date:day(6,8)},
{id:'11',type:'expense',amount:100,category:'Transport',subcategory:'CNG',description:'CNG fare',paymentMethod:'cash',date:day(6,10)},
{id:'12',type:'expense',amount:130,category:'Entertainment',description:'Movie night',paymentMethod:'bkash',date:day(7,18)},
{id:'13',type:'expense',amount:75,category:'Food & Drinks',subcategory:'Lunch',description:'Campus lunch',paymentMethod:'cash',date:day(8,13)},
]}
export const mockBudgets:Budget[]=[{id:'daily',name:'Daily spending',amount:500,period:'daily'},{id:'monthly',name:'Monthly spending',amount:8000,period:'monthly'},{id:'food',name:'Food & Drinks',amount:2500,period:'monthly',category:'Food & Drinks'},{id:'transport',name:'Transport',amount:1500,period:'monthly',category:'Transport'}];
export const defaultPreferences:UserPreferences={displayName:'Arafat Rahman',currency:'BDT',dailyBudget:300,theme:'system',weekStart:'sunday',paymentMethod:'cash',notifications:true,timezone:'Asia/Dhaka'};
