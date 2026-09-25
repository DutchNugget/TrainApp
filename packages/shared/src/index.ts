export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;


export type SetType = typeof SET_TYPES[number];