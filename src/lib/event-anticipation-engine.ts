export interface FutureEvent{event:string;horizonDays:number;probability:number;impact:number;signals:string[];invalidation:string[];}
export function anticipateEvents(input:{rate:number;rateChange:number;inventory:number;dom:number;credit:number;employment:number}):FutureEvent[]{return[
 {event:"financing conditions shift",horizonDays:90,probability:Math.min(1,Math.abs(input.rateChange)*30),impact:-Math.sign(input.rateChange)*.4,signals:["mortgage rates","policy rate"],invalidation:["stable rates"]},
 {event:"market liquidity changes",horizonDays:120,probability:Math.min(1,.3+input.dom*.5+input.inventory*.4),impact:-.5,signals:["DOM","inventory","withdrawals"],invalidation:["transaction recovery"]},
 {event:"demand regime changes",horizonDays:180,probability:Math.min(1,.2+Math.abs(input.credit)*2+Math.abs(input.employment)*2),impact:-.4,signals:["credit","employment"],invalidation:["credit acceleration"]},
];}