import type { CargoCore, CargoPlacement } from "./cargoPlacement";

const EPS = 1e-6;
export interface CargoMassLedger {
  totalKg: number;
  centroidAboveCoreFloorM: number | null;
  floorBaseCount: number;
  supportedAboveCount: number;
  maxStackMassKg: number | null;
  allocatedKg: number;
  valid: boolean;
}

/**
 * Bookkeeping for the planner's single-support AABB model. Each supported
 * carton is attributed to one base carton. This is not a calculation of
 * contact forces, floor pressure, strength, aircraft trim or dynamic loads.
 * Ambiguous, unsupported, overlapping or out-of-core input fails closed.
 */
export function cargoMassLedger(boxes: readonly CargoPlacement[], core: CargoCore): CargoMassLedger {
  const invalid: CargoMassLedger = {
    totalKg: 0, centroidAboveCoreFloorM: null, floorBaseCount: 0,
    supportedAboveCount: 0, maxStackMassKg: null, allocatedKg: 0, valid: false,
  };
  if (![core.minX,core.minZ,core.floorY,core.widthM,core.depthM,core.heightM].every(Number.isFinite)
    || Math.min(core.widthM,core.depthM,core.heightM) <= 0) return invalid;
  const ids = new Set<string>();
  const entries = boxes.map(b => ({
    ...b, loX: b.x-b.widthM/2, hiX: b.x+b.widthM/2,
    loY: b.y-b.heightM/2, hiY: b.y+b.heightM/2,
    loZ: b.z-b.depthM/2, hiZ: b.z+b.depthM/2,
  })).sort((a,b) => a.loY-b.loY);
  for (const b of entries) {
    if (!b.id || ids.has(b.id) || ![b.x,b.y,b.z,b.widthM,b.heightM,b.depthM,b.massKg].every(Number.isFinite)
      || Math.min(b.widthM,b.heightM,b.depthM,b.massKg) <= 0
      || b.loX < core.minX-EPS || b.hiX > core.minX+core.widthM+EPS
      || b.loZ < core.minZ-EPS || b.hiZ > core.minZ+core.depthM+EPS
      || b.loY < core.floorY-EPS || b.hiY > core.floorY+core.heightM+EPS) return invalid;
    ids.add(b.id);
  }
  const roots = new Map<string,string>();
  const stacks = new Map<string,number>();
  let totalKg = 0, weightedHeight = 0, supportedAboveCount = 0;
  for (let i=0;i<entries.length;i++) {
    const b=entries[i], previous=entries.slice(0,i);
    if (previous.some(p => p.loX < b.hiX-EPS && p.hiX > b.loX+EPS
      && p.loY < b.hiY-EPS && p.hiY > b.loY+EPS
      && p.loZ < b.hiZ-EPS && p.hiZ > b.loZ+EPS)) return invalid;
    let root=b.id;
    if (b.loY > core.floorY+EPS) {
      const supports = previous.filter(p => Math.abs(p.hiY-b.loY)<=EPS
        && b.loX>=p.loX-EPS && b.hiX<=p.hiX+EPS
        && b.loZ>=p.loZ-EPS && b.hiZ<=p.hiZ+EPS);
      if (supports.length!==1 || !roots.has(supports[0].id)) return invalid;
      root=roots.get(supports[0].id)!;
      supportedAboveCount++;
    }
    roots.set(b.id,root);
    stacks.set(root,(stacks.get(root)??0)+b.massKg);
    totalKg+=b.massKg;
    weightedHeight+=b.massKg*(b.y-core.floorY);
  }
  const allocatedKg=[...stacks.values()].reduce((a,b)=>a+b,0);
  if (![totalKg,weightedHeight,allocatedKg].every(Number.isFinite)) return invalid;
  return {
    totalKg, centroidAboveCoreFloorM: totalKg>0?weightedHeight/totalKg:null,
    floorBaseCount: stacks.size, supportedAboveCount,
    maxStackMassKg: stacks.size?Math.max(...stacks.values()):null,
    allocatedKg,valid: true,
  };
}
