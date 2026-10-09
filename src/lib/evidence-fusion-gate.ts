/**
 * Reality Investor — Evidence Fusion Gate.
 *
 * Prevents correlated/copying sources from masquerading as independent evidence.
 * Sources are clustered by claim identity and discounted by dependence.
 */

export interface EvidenceClaim {
  id:string;
  claimKey:string;
  source:string;
  sourceFamily:string;
  publishedAt:string;
  reliability:number;
  direction:"POSITIVE"|"NEGATIVE"|"NEUTRAL";
  strength:number;
}

export interface FusedEvidence {
  claimKey:string;
  netSupport:number;
  effectiveEvidenceCount:number;
  independentSourceFamilies:number;
  dominantDirection:"POSITIVE"|"NEGATIVE"|"CONFLICTED"|"NEUTRAL";
  sources:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function fuseEvidenceClaims(
  claims:EvidenceClaim[],
):FusedEvidence[]{
  const groups=new Map<string,EvidenceClaim[]>();
  for(const c of claims){
    const g=groups.get(c.claimKey)??[];
    g.push(c); groups.set(c.claimKey,g);
  }

  return [...groups.entries()].map(([claimKey,group])=>{
    const familyBest=new Map<string,EvidenceClaim>();
    for(const c of group){
      const old=familyBest.get(c.sourceFamily);
      if(!old || c.reliability*c.strength>old.reliability*old.strength){
        familyBest.set(c.sourceFamily,c);
      }
    }

    const independent=[...familyBest.values()];
    const pos=independent.filter(c=>c.direction==="POSITIVE")
      .reduce((s,c)=>s+c.reliability*c.strength,0);
    const neg=independent.filter(c=>c.direction==="NEGATIVE")
      .reduce((s,c)=>s+c.reliability*c.strength,0);
    const total=pos+neg;
    const ratio=total?Math.abs(pos-neg)/total:0;
    const direction=
      pos>0&&neg>0&&ratio<.35?"CONFLICTED":
      pos>neg?"POSITIVE":
      neg>pos?"NEGATIVE":"NEUTRAL";

    return {
      claimKey,
      netSupport:clamp((pos-neg),-1,1),
      effectiveEvidenceCount:independent.length,
      independentSourceFamilies:independent.length,
      dominantDirection:direction,
      sources:independent.map(c=>c.source),
    };
  });
}
