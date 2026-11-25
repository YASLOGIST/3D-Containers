import * as THREE from "three";

/**
 * Assign only the existing flat upward-facing cavity floor to a separate
 * finish. Preserve triangle order, positions, normals and the closed hull.
 * The floor finish is illustrative, not a load-bearing material specification.
 */
export function applyInteriorFloorGroups(geometry: THREE.BufferGeometry, floorY: number): number {
  if (geometry.index) throw new Error("Expected nonindexed extruded hull");
  const p=geometry.getAttribute("position"), n=geometry.getAttribute("normal"), uv=geometry.getAttribute("uv");
  if(!p||!n||!uv||p.count%3!==0) throw new Error("Incomplete hull attributes");
  const selected:number[]=[];
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<p.count;i+=3){
    if(![i,i+1,i+2].every(j=>Math.abs(p.getY(j)-floorY)<1e-6
      &&n.getY(j)>.9999&&Math.abs(n.getX(j))<1e-4&&Math.abs(n.getZ(j))<1e-4))continue;
    selected.push(i);
    for(let j=i;j<i+3;j++){
      minX=Math.min(minX,p.getX(j));maxX=Math.max(maxX,p.getX(j));
      minZ=Math.min(minZ,p.getZ(j));maxZ=Math.max(maxZ,p.getZ(j));
    }
  }
  if(!selected.length||maxX-minX<1e-6||maxZ-minZ<1e-6)throw new Error("No planar cavity floor");
  const set=new Set(selected);
  for(const i of selected)for(let j=i;j<i+3;j++)
    uv.setXY(j,(p.getX(j)-minX)/(maxX-minX),(p.getZ(j)-minZ)/(maxZ-minZ));
  uv.needsUpdate=true;
  geometry.clearGroups();
  let start=0,materialIndex=set.has(0)?1:0;
  for(let i=3;i<p.count;i+=3){
    const next=set.has(i)?1:0;
    if(next!==materialIndex){geometry.addGroup(start,i-start,materialIndex);start=i;materialIndex=next;}
  }
  geometry.addGroup(start,p.count-start,materialIndex);
  return selected.length;
}

export function makeInteriorFloorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color:"#929ba0",metalness:.65,roughness:.64,envMapIntensity:.55,
    userData:{wearSurface:"interior"},
  });
}
