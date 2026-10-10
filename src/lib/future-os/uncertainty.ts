export type UncertaintyInputs = {
  dataUncertainty: number;
  modelDisagreement: number;
  parameterUncertainty: number;
  regimeUncertainty: number;
};

export type UncertaintyDecomposition = {
  total: number;
  shares: {
    data: number;
    model: number;
    parameter: number;
    regime: number;
  };
  dominant: "DATA" | "MODEL" | "PARAMETER" | "REGIME" | "MIXED";
};

export function decomposeUncertainty(input: UncertaintyInputs): UncertaintyDecomposition {
  const values=[
    Math.max(0,input.dataUncertainty),
    Math.max(0,input.modelDisagreement),
    Math.max(0,input.parameterUncertainty),
    Math.max(0,input.regimeUncertainty),
  ];
  const total=values.reduce((s,x)=>s+x,0);
  const shares=total?{
    data:values[0]!/total,
    model:values[1]!/total,
    parameter:values[2]!/total,
    regime:values[3]!/total,
  }:{data:.25,model:.25,parameter:.25,regime:.25};
  const entries=Object.entries(shares) as Array<[keyof typeof shares,number]>;
  entries.sort((a,b)=>b[1]-a[1]);
  const dominant=entries[0][1]!-entries[1][1]!<0.15?"MIXED":({
    data:"DATA",model:"MODEL",parameter:"PARAMETER",regime:"REGIME",
  } as const)[entries[0][0]!];
  return {total,shares,dominant};
}
