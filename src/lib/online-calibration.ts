/**
 * Reality Investor — Online bias-corrected conformal layer.
 *
 * Inspired by recent work on adaptive conformal forecasting under distribution
 * shift. This implementation is deliberately lightweight and transparent:
 * it tracks recent signed residual bias separately from residual magnitude.
 *
 * It must be calibrated on real point-in-time outcomes before being described
 * as having empirical coverage guarantees for the Czech housing market.
 */

export interface OnlineCalibrationState {
  bias:number;
  radius:number;
  alpha:number;
  updates:number;
}

export interface CalibratedInterval {
  center:number;
  low:number;
  high:number;
  biasCorrection:number;
  radius:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function updateOnlineCalibration(
  state:OnlineCalibrationState,
  predicted:number,
  actual:number,
  learningRate=.08
):OnlineCalibrationState{
  const residual=actual-predicted;
  const bias=state.bias*(1-learningRate)+residual*learningRate;
  const nonconformity=Math.abs(residual-bias);
  const radius=state.radius*(1-learningRate)+nonconformity*learningRate;
  return {...state,bias,radius,updates:state.updates+1};
}

export function calibratedInterval(
  state:OnlineCalibrationState,
  predicted:number
):CalibratedInterval{
  const center=predicted+state.bias;
  const radius=Math.max(0,state.radius);
  return {center,low:center-radius,high:center+radius,biasCorrection:state.bias,radius};
}

export function calibrationTrust(state:OnlineCalibrationState):number{
  if(state.updates<10)return .15;
  const stability=1/(1+Math.abs(state.bias)/(Math.max(state.radius,.0001)));
  return clamp(stability*(1-Math.exp(-state.updates/40)),0,1);
}
