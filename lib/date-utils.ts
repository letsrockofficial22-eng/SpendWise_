// All period boundaries use the selected IANA zone, not the server or browser zone.
let timezone='Asia/Dhaka';
export function setTimeZone(zone:string){timezone=zone}
export function getTimeZone(){return timezone}
function parts(date:Date,zone=timezone){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);return Object.fromEntries(p.map(x=>[x.type,x.value]))}
export const dateKey=(d:Date|string)=>{if(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d))return d;const p=parts(new Date(d));return `${p.year}-${p.month}-${p.day}`};
export const today=()=>dateKey(new Date());
export const localInput=(d=new Date())=>{const p=parts(d);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`};
// Convert a wall-clock time in the selected zone to an absolute timestamp.
export function zonedInputToISO(input:string){const match=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(input);if(!match)throw new Error('Invalid date');const target=Date.UTC(+match[1],+match[2]-1,+match[3],+match[4],+match[5]);let instant=target;for(let i=0;i<3;i++){const p=parts(new Date(instant));const wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);instant+=target-wall}if(localInput(new Date(instant))!==input)throw new Error('This local time does not exist in your timezone.');return new Date(instant).toISOString()}
export function addDays(day:string,n:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const prettyDate=(d:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric',year:'numeric'})=>new Date(/^\d{4}-\d\d-\d\d$/.test(d)?d+'T12:00:00Z':d).toLocaleDateString('en-US',{...options,timeZone:timezone});
