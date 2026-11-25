import * as THREE from "three";
import { MODELS, type ModelId } from "./models";
import { mesh } from "./primitives";
import { axialCamSleeve, camStroke } from "./axialCamTrack";
import { axialAntiRotationGuideGeometry, AXIAL_GUIDE } from "./axialAntiRotationGuide";

/**
 * Opt-in research assembly for selected rigid non-reefer families. Not used by the public viewer.
 * All dimensions are illustrative. No load, fatigue or airworthiness claim.
 */
export function buildAKEAxialLatchPrototype(detail = true) {
  return buildAxialLatchPrototype("ake",detail);
}
export const AXIAL_RESEARCH_MODELS = ["ake","akc","dpe","dqf","aqp","akh","alf","alp","aap","ama","aga"] as const;
export function buildAxialLatchPrototype(id:ModelId,detail = true) {
  if(!AXIAL_RESEARCH_MODELS.some(x=>x===id))throw new RangeError("Unsupported prototype family: "+id);
  const model = MODELS[id].build({contour:true,finish:"mill",detail,rivets:detail,
    doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
  try {
    const pivot = model.doorPivot!;
    const spindles = pivot.children.filter(o => o.name === "Articulated cam latch spindle");
    const keepers: THREE.Mesh[] = [];
    model.group.traverse(o=>{if(o instanceof THREE.Mesh && o.name==="Latch keeper")keepers.push(o);});
    if(spindles.length!==2 || keepers.length!==4 || !pivot.parent)throw new Error("Unexpected axial research baseline");
    // Old solid keepers are suppressed in both rendering and geometry-only export.
    keepers.forEach(k=>k.visible=false);
    const pins: {mesh: THREE.Mesh; closedY: number; direction: number; spindle: THREE.Object3D; hand: 1|-1}[]=[];
    const followers: THREE.Mesh[]=[];
    const antiRotationGuides: THREE.Mesh[]=[];
    const guideMounts: THREE.Mesh[]=[];
    const leaf=pivot.getObjectByName("Door leaf") as THREE.Mesh;
    leaf.geometry.computeBoundingBox();
    const leafFace=leaf.geometry.boundingBox!.max.z;
    const receivers: THREE.Mesh[]=[];
    const guides: THREE.Mesh[]=[];
    const section=(outer:number,inner:number,half:number)=>new THREE.LatheGeometry([
      new THREE.Vector2(outer,-half),new THREE.Vector2(outer,half),
      new THREE.Vector2(inner,half),new THREE.Vector2(inner,-half),
      new THREE.Vector2(outer,-half)],32);
    const ringGeometry=section(.015,.009,.0015);
    const pinGeometry=new THREE.CylinderGeometry(.007,.007,.032,24);
    const followerGeometry=new THREE.CylinderGeometry(AXIAL_GUIDE.followerRadius,AXIAL_GUIDE.followerRadius,AXIAL_GUIDE.followerLength,16);
    const antiRotationGeometry=axialAntiRotationGuideGeometry();
    const frame=model.group.getObjectByName("Door end frame") as THREE.Mesh;
    model.group.updateMatrixWorld(true);
    const probeMat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const probe=new THREE.Mesh(frame.geometry,probeMat);probe.matrixWorld.copy(frame.matrixWorld);
    const ray=new THREE.Raycaster();
    const seats=(s:THREE.Object3D)=>{
      const pos=s.getWorldPosition(new THREE.Vector3());
      return [false,true].map(top=>{
        ray.set(new THREE.Vector3(pos.x,top?MODELS[id].dims.height*.5:.3,pos.z),new THREE.Vector3(0,top?1:-1,0));
        const hit=ray.intersectObject(probe,false)[0];
        if(!hit)throw new Error("Missing frame seat "+id);
        return hit.point.y;
      });
    };
    for(const [i,s] of spindles.entries()){
      if(id==="ake")s.position.x+=i===0?.075:-.06;
      s.updateWorldMatrix(true,false);
      const [bottom,topY]=seats(s);
      for(const part of s.children)
        if(["Latch handle","Latch hub","Rotating latch cam"].includes(part.name)&&part.position.y<.4)part.position.y+=.11;
      if(id!=="ake")for(const part of s.children)if(["Latch handle","Latch hub","Rotating latch cam"].includes(part.name)&&part.position.y>topY-.22)part.position.y-=.12;
      const rod=s.children.find(o=>o.name==="Cam latch rod") as THREE.Mesh;
      rod.geometry.computeBoundingBox();
      const min=bottom+.025,max=topY-.025;
      const half=(max-min)/2;rod.position.y=(max+min)/2;
      const previous=rod.geometry;
      const hand:1|-1=i===0?1:-1;
      rod.geometry=axialCamSleeve(half,bottom+.031-rod.position.y,topY-.031-rod.position.y,hand);
      previous.dispose();
      guides.push(rod);
      for(const top of [false,true]){
        const ring=mesh(ringGeometry,model.materials.latchContact,"Prototype axial receiver");
        ring.position.set(s.position.x+pivot.position.x,top?topY-.001501:bottom+.001501,s.position.z+pivot.position.z);
        pivot.parent.add(ring);
        receivers.push(ring);
        const bolt=mesh(pinGeometry,model.materials.steel,"Prototype retracting bolt");
        const closedY=top?topY-.017:bottom+.017;
        bolt.position.set(s.position.x,closedY,s.position.z);
        // The follower remains aligned to the door, while the cam sleeve rotates.
        pivot.add(bolt);
        const follower=mesh(followerGeometry,model.materials.latchContact,"Prototype cam follower");
        follower.rotation.z=-Math.PI/2;
        follower.position.set(AXIAL_GUIDE.followerCenterX,top?-.014:.014,0);
        bolt.add(follower);followers.push(follower);
        const channel=mesh(antiRotationGeometry,model.materials.steel,"Prototype anti-rotation channel");
        channel.position.set(s.position.x,top?topY-.046:bottom+.046,s.position.z);
        pivot.add(channel);antiRotationGuides.push(channel);
        // Representative mounting tabs, not fastened or load-rated joints.
        const back=leafFace+.000001,front=channel.position.z-.003;
        if(front<=back)throw new Error("Invalid guide mount depth");
        for(const end of [-1,1]){
          const tab=mesh(new THREE.BoxGeometry(.005,.006,front-back),model.materials.steel,"Prototype guide mount");
          tab.position.set(channel.position.x+.017,channel.position.y+end*.014,(back+front)/2);
          pivot.add(tab);guideMounts.push(tab);
        }
        pins.push({mesh:bolt,closedY,direction:top?-1:1,spindle:s,hand});
      }
    }
    probeMat.dispose();
    const baseSetDoorOpen=model.setDoorOpen.bind(model);
    const setDoorOpen=(progress:number)=>{
      baseSetDoorOpen(progress);
      pins.forEach(p=>p.mesh.position.y=p.closedY+p.direction*camStroke(p.spindle.rotation.y,p.hand));
    };
    // The research adapter and its underlying model share one motion entry point.
    model.setDoorOpen=setDoorOpen;
    setDoorOpen(0);
    return {model, guides, pins, receivers, followers, antiRotationGuides, guideMounts, originalKeepers:keepers, setDoorOpen};
  }catch(error){model.dispose();throw error;}
}
