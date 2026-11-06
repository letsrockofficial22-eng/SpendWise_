import {Capacitor} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
import {localReminderTime} from './finance-utils';

function notificationId(kind:'loan'|'bill',id:string){
  let hash=kind==='loan'?0x51f15e:0x2a71c3;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),0x45d9f3b);
  return (hash&0x7fffffff)||1;
}

export async function scheduleReminder(kind:'loan'|'bill',id:string,title:string,dueDate:string,enabled=true){
  if(!Capacitor.isNativePlatform())return false;
  const idNumber=notificationId(kind,id);
  await LocalNotifications.cancel({notifications:[{id:idNumber}]});
  if(!enabled)return false;
  const at=localReminderTime(dueDate);
  if(!at)return false;
  let permission=await LocalNotifications.checkPermissions();
  if(permission.display!=='granted')permission=await LocalNotifications.requestPermissions();
  if(permission.display!=='granted')return false;
  await LocalNotifications.schedule({notifications:[{
    id:idNumber,
    title:'SpendWise payment reminder',
    body:`${title} is due tomorrow.`,
    schedule:{at,allowWhileIdle:true},
  }]});
  return true;
}

export async function cancelReminder(kind:'loan'|'bill',id:string){
  if(!Capacitor.isNativePlatform())return;
  await LocalNotifications.cancel({notifications:[{id:notificationId(kind,id)}]});
}
