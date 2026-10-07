/**
 * Reality Investor — Market Shock Decomposition.
 *
 * Separates price, quantity, liquidity and timing channels so the future
 * engine does not confuse a price move with a change in market activity.
 */

export interface ShockObservation {
  period:string;
  priceGrowth:number;
  transactionGrowth:number;
  inventoryGrowth:number;
  domGrowth:number;
  timeToCloseGrowth:number;
  mortgageRateChange:number;
  rentGrowth:number;
}

export interface ShockChannel {
  name:"PRICE"|"QUANTITY"|"INVENTORY"|"LIQUIDITY"|"CLOSING_TIME"|"FINANCING"|"RENT";
  pressure:number;
  direction:"UP"|"DOWN"|"NEUTRAL";
  interpretation:string;
}

export interface MarketShockDecomposition {
  compositeShock:number;
  channels:ShockChannel[];
  shockType:"DEMAND_SHOCK"|"SUPPLY_SHOCK"|"FINANCING_SHOCK"|"LIQUIDITY_SHOCK"|"MIXED"|"NONE";
  confidence:number;
  nextBestObservation:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function channel(name:ShockChannel["name"],value:number,scale:number,interpretation:string):ShockChannel{
  const pressure=clamp(Math.abs(value)/scale,0,1);
  return {name,pressure,direction:value>.15?"UP":value<-.15?"DOWN":"NEUTRAL",interpretation};
}

export function decomposeMarketShock(o:ShockObservation):MarketShockDecomposition{
  const channels=[
    channel("PRICE",o.priceGrowth,.10,"Price movement is an outcome, not by itself a causal explanation."),
    channel("QUANTITY",o.transactionGrowth,.15,"Transaction volume reveals demand-side activity."),
    channel("INVENTORY",o.inventoryGrowth,.20,"Inventory changes alter bargaining power and future supply."),
    channel("LIQUIDITY",o.domGrowth,.25,"Time-on-market captures listing liquidity."),
    channel("CLOSING_TIME",o.timeToCloseGrowth,.25,"Time-to-close is a distinct transaction-timing channel."),
    channel("FINANCING",o.mortgageRateChange,.03,"Financing conditions affect affordability and demand."),
    channel("RENT",o.rentGrowth,.08,"Rent movement informs income support for investors."),
  ];

  const demand=o.transactionGrowth-o.mortgageRateChange*2-o.inventoryGrowth;
  const supply=o.inventoryGrowth-o.transactionGrowth;
  const financing=Math.abs(o.mortgageRateChange)*2;
  const liquidity=Math.max(0,o.domGrowth)+Math.max(0,o.timeToCloseGrowth);
  const candidates=[
    ["DEMAND_SHOCK",Math.abs(demand)],
    ["SUPPLY_SHOCK",Math.abs(supply)],
    ["FINANCING_SHOCK",financing],
    ["LIQUIDITY_SHOCK",liquidity],
  ] as const;
  candidates.sort((a,b)=>b[1]-a[1]);
  const top=candidates[0];
  const mixed=Math.abs(candidates[0][1]-candidates[1][1])<.05;
  const composite=clamp(
    (Math.abs(o.priceGrowth)+Math.abs(o.transactionGrowth)+Math.abs(o.inventoryGrowth)+
      Math.abs(o.mortgageRateChange)*2+Math.abs(o.domGrowth)+Math.abs(o.timeToCloseGrowth))/0.6,
    0,1
  );

  return {
    compositeShock:composite,
    channels,
    shockType:composite<.15?"NONE":mixed?"MIXED":top[0],
    confidence:clamp(.45+channels.filter(x=>x.direction!=="NEUTRAL").length*.06,0.2,.9),
    nextBestObservation:liquidity>.2
      ?"transaction completion dates + realized prices"
      :financing>.2
        ?"mortgage approvals + new housing credit"
        :"transaction volume + inventory",
  };
}
