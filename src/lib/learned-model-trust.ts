/**
 * Reality Investor — Learning to Trust Adapter.
 *
 * Converts matured contextual learning states into the existing Model Trust
 * Router inputs. This keeps empirical feedback separate from structural priors.
 */

import {routeModelTrust,type ModelTrustCandidate,type RoutedModel} from "./model-trust-router";
import type {ModelLearningState} from "./forecast-learning-loop";

export function routeLearnedModelTrust(
  states:ModelLearningState[],
  base:Omit<ModelTrustCandidate,"model"|"recencyTrust"|"sampleSize">[]=[],
):RoutedModel[]{
  const byModel=new Map<string,ModelLearningState[]>();
  for(const s of states){
    const list=byModel.get(s.modelId)??[];
    list.push(s);
    byModel.set(s.modelId,list);
  }

  const candidates:ModelTrustCandidate[]=states.map(s=>{
    const peers=byModel.get(s.modelId)??[s];
    const contextual=peers.reduce((sum,x)=>sum+x.trust,0)/Math.max(1,peers.length);
    const template=base[0];
    return {
      model:s.modelId,
      genomeScore:template?.genomeScore??contextual,
      regimeScore:Math.min(1,s.recentScore),
      submarketScore:Math.min(1,s.recentCalibration),
      recencyTrust:contextual,
      evidenceQuality:Math.min(1,s.casesUsed/20),
      driftPenalty:0,
      sampleSize:s.casesUsed,
    };
  });

  return routeModelTrust(candidates);
}
