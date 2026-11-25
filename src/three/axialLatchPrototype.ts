import * as THREE from "three";
import { MODELS } from "./models";
import { mesh } from "./primitives";
import { axialCamSleeve, camStroke } from "./axialCamTrack";

/**
 * Opt-in AKE-only research assembly. Not used by the public viewer.
 * All dimensions are illustrative. No load, fatigue or airworthiness claim.
 */
export function buildAKEAxialLatchPrototype(detail = true) {
  const model = MODELS.ake.build({contour:true,finish:"mill",detail,rivets:detail,
    doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
  try {
    const pivot = model.doorPivot!;
    const spindles = pivot.children.filter(o => o.name === "Articulated cam latch spindle");
    const keepers: THREE.Mesh[] = [];
    model.group.traverse(o=>{if(o instanceof THREE.Mesh && o.name==="Latch keeper")keepers.push(o);});
    if(spindles.length!==2 || keepers.length!==4 || !pivot.parent)throw new Error("Unexpected AKE research baseline");
    // Old solid keepers are suppressed in both rendering and geometry-only export.
    keepers.forEach(k=>k.visible=false);
    const pins: {mesh: THREE.Mesh; closedY: number; direction: number; spindle: THREE.Object3D; hand: 1|-1}[]=[];
    const followers: THREE.Mesh[]=[];
    const receivers: THREE.Mesh[]=[];
    const guides: THREE.Mesh[]=[];
    const section=(outer:number,inner:number,half:number)=>new THREE.LatheGeometry([
      new THREE.Vector2(outer,-half),new THREE.Vector2(outer,half),
      new THREE.Vector2(inner,half),new THREE.Vector2(inner,-half),
      new THREE.Vector2(outer,-half)],32);
    const ringGeometry=section(.015,.009,.0015);
    const pinGeometry=new THREE.CylinderGeometry(.007,.007,.032,24);
    const followerGeometry=new THREE.CylinderGeometry(.001,.001,.005,16);
    for(const [i,s] of spindles.entries()){
      if(i===0)s.position.x+=.075;
      for(const part of s.children)
        if(["Latch handle","Latch hub","Rotating latch cam"].includes(part.name)&&part.position.y<.4)part.position.y+=.11;
      const rod=s.children.find(o=>o.name==="Cam latch rod") as THREE.Mesh;
      rod.geometry.computeBoundingBox();
      const half=rod.geometry.boundingBox!.max.y;
      const previous=rod.geometry;
      const hand:1|-1=i===0?1:-1;
      rod.geometry=axialCamSleeve(half,.196-rod.position.y,1.514-rod.position.y,hand);
      previous.dispose();
      guides.push(rod);
      for(const top of [false,true]){
        const ring=mesh(ringGeometry,model.materials.latchContact,"Prototype axial receiver");
        ring.position.set(s.position.x+pivot.position.x,top?1.543499:.166501,s.position.z+pivot.position.z);
        pivot.parent.add(ring);
        receivers.push(ring);
        const bolt=mesh(pinGeometry,model.materials.steel,"Prototype retracting bolt");
        const closedY=top?1.528:.182;
        bolt.position.set(s.position.x,closedY,s.position.z);
        // The follower remains aligned to the door, while the cam sleeve rotates.
        pivot.add(bolt);
        const follower=mesh(followerGeometry,model.materials.latchContact,"Prototype cam follower");
        follower.rotation.z=-Math.PI/2;
        follower.position.set(.0095,top?-.014:.014,0);
        bolt.add(follower);followers.push(follower);
        pins.push({mesh:bolt,closedY,direction:top?-1:1,spindle:s,hand});
      }
    }
    const baseSetDoorOpen=model.setDoorOpen.bind(model);
    const setDoorOpen=(progress:number)=>{
      baseSetDoorOpen(progress);
      pins.forEach(p=>p.mesh.position.y=p.closedY+p.direction*camStroke(p.spindle.rotation.y,p.hand));
    };
    // The research adapter and its underlying model share one motion entry point.
    model.setDoorOpen=setDoorOpen;
    setDoorOpen(0);
    return {model, guides, pins, receivers, followers, originalKeepers:keepers, setDoorOpen};
  }catch(error){model.dispose();throw error;}
}
