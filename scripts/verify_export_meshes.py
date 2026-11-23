"""Independent, dependency-free structural checks for exported ULD meshes.

Usage: python3 scripts/verify_export_meshes.py DIRECTORY [MODEL ...]
Requires model.glb, model.obj, model.stl for each model.
Compares physical mesh envelopes: printed/ink-only GLB decorations carrying
visualOnlyDecal=true are intentionally ignored, as they do not occur in OBJ/STL.
Does not prove manifold quality, physical safety or manufacturer accuracy.
"""
import json, struct, math, pathlib, sys
BASE=pathlib.Path(".")
def finite(a):return all(math.isfinite(x) for x in a)
def mm():
 return [[math.inf]*3,[-math.inf]*3]
def extend(bb,x):
 if not finite(x):raise AssertionError("Non-finite vertex")
 for i in range(3):bb[0][i]=min(bb[0][i],x[i]);bb[1][i]=max(bb[1][i],x[i])
def dims(bb):return [round(bb[1][i]-bb[0][i],4) for i in range(3)]
def eye():return (1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.)
def mult(a,b):
 return tuple(sum(a[r*4+k]*b[k*4+c] for k in range(4)) for r in range(4) for c in range(4))
def transform(mat,p):
 x,y,z=p
 return (mat[0]*x+mat[1]*y+mat[2]*z+mat[3],mat[4]*x+mat[5]*y+mat[6]*z+mat[7],mat[8]*x+mat[9]*y+mat[10]*z+mat[11])
def trs(t=(0,0,0),q=(0,0,0,1),s=(1,1,1)):
 x,y,z,w=q; sx,sy,sz=s
 xx=x*x;yy=y*y;zz=z*z;xy=x*y;xz=x*z;yz=y*z;wx=w*x;wy=w*y;wz=w*z
 return ((1-2*(yy+zz))*sx,(2*(xy-wz))*sy,(2*(xz+wy))*sz,t[0],
         (2*(xy+wz))*sx,(1-2*(xx+zz))*sy,(2*(yz-wx))*sz,t[1],
         (2*(xz-wy))*sx,(2*(yz+wx))*sy,(1-2*(xx+yy))*sz,t[2],
          0.,0.,0.,1.)
def matrix(node):
 if "matrix" in node:
  v=node["matrix"];return tuple(v[c*4+r] for r in range(4) for c in range(4))
 return trs(node.get("translation",(0,0,0)),node.get("rotation",(0,0,0,1)),node.get("scale",(1,1,1)))
def corners(lo,hi):
 for i in range(8):yield tuple(hi[j] if (i>>j)&1 else lo[j] for j in range(3))
def obj(path):
 b=mm();vert=0;face=0
 with path.open(encoding="utf-8") as f:
  for line in f:
   if line.startswith("v "):
    p=line.strip().split()[1:4]
    extend(b,tuple(float(x) for x in p))
    vert+=1
   elif line.startswith("f "):face+=1
 assert vert>100 and face>100,(path,vert,face)
 return dict(dim=dims(b),vertex=vert,faces=face)
def stl(path):
 data=path.read_bytes()
 assert len(data)>=84 and data[:5]!=b"solid", "Expect binary STL"
 count=struct.unpack_from("<I",data,80)[0]
 assert count>100 and len(data)==84+50*count,(count,len(data))
 b=mm()
 for pos in range(84,len(data),50):
  for p in (pos+12,pos+24,pos+36):
   extend(b,struct.unpack_from("<fff",data,p))
 return dict(dim=dims(b),faces=count)
def glb(path):
 data=path.read_bytes()
 magic,version,length=struct.unpack_from("<III",data,0)
 assert magic==0x46546c67 and version==2 and length==len(data)
 njson,jtyp=struct.unpack_from("<I4s",data,12)
 assert jtyp==b"JSON"
 meta=json.loads(data[20:20+njson])
 offset=20+njson
 nbin,btyp=struct.unpack_from("<I4s",data,offset)
 assert btyp==b"BIN\x00"
 blob=memoryview(data)[offset+8:offset+8+nbin]
 assert len(blob)==nbin
 accessors=meta["accessors"];views=meta["bufferViews"]
 fmt={5126:("f",4),5125:("I",4),5123:("H",2),5121:("B",1),5122:("h",2),5120:("b",1)}
 comps={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
 def read_accessor(index,i):
  a=accessors[index];v=views[a["bufferView"]]
  code,size=fmt[a["componentType"]];n=comps[a["type"]]
  stride=v.get("byteStride",size*n)
  start=v.get("byteOffset",0)+a.get("byteOffset",0)+i*stride
  return struct.unpack_from("<"+code*n,blob,start)
 def box_for_mesh(meshidx,world):
  for prim in meta["meshes"][meshidx]["primitives"]:
   ai=prim.get("attributes",{}).get("POSITION")
   if ai is None:continue
   a=accessors[ai]
   if "min" in a and "max" in a:
    for c in corners(a["min"],a["max"]):extend(box,transform(world,c))
   else:
    for i in range(a["count"]):extend(box,transform(world,read_accessor(ai,i)))
 box=mm()
 nodes=meta["nodes"]
 countNodes=0;instanced=0
 def visit(index,parent):
  nonlocal countNodes,instanced
  node=nodes[index]
  # GLB deliberately retains textured/printed visual decals. OBJ/STL are
  # geometry-only, so exclude marked ink/labels from its comparison envelope.
  # This ignores no physical shell or structural parts.
  if node.get("extras", {}).get("visualOnlyDecal") is True:
   return
  model=mult(parent,matrix(node))
  if "mesh" in node:
   countNodes+=1
   ext=node.get("extensions",{}).get("EXT_mesh_gpu_instancing")
   if ext:
    attrs=ext.get("attributes",{})
    howmany=accessors[next(iter(attrs.values()))]["count"]
    instanced+=howmany
    for i in range(howmany):
     t=read_accessor(attrs["TRANSLATION"],i) if "TRANSLATION" in attrs else (0,0,0)
     q=read_accessor(attrs["ROTATION"],i) if "ROTATION" in attrs else (0,0,0,1)
     s=read_accessor(attrs["SCALE"],i) if "SCALE" in attrs else (1,1,1)
     box_for_mesh(node["mesh"],mult(model,trs(t,q,s)))
   else:box_for_mesh(node["mesh"],model)
  for child in node.get("children",[]):visit(child,model)
 scene=meta["scenes"][meta.get("scene",0)]
 for i in scene.get("nodes",[]):visit(i,eye())
 assert countNodes>10,("GLB no renderable nodes",countNodes)
 return dict(dim=dims(box),nodes=countNodes,instances=instanced,materials=len(meta.get("materials",[])),mesh=len(meta.get("meshes",[])),ext=meta.get("extensionsUsed",[]))
def check(model):
 out={}
 for ext,fn in (("glb",glb),("obj",obj),("stl",stl)):
  out[ext]=fn(BASE/(model+"."+ext))
 assert all(0<d<80 for item in out.values() for d in item["dim"]), ("implausible size",out)
 delta=[max(x["dim"][i] for x in out.values())-min(x["dim"][i] for x in out.values()) for i in range(3)]
 out["largest_axis_disagreement_m"]=round(max(delta),4)
 out["model"]=model
 print(json.dumps(out,ensure_ascii=False))
 if max(delta)>0.002:
  print("FAIL: more than 2 mm disagreement across formats",model,delta,file=sys.stderr)
 return out
if __name__=="__main__":
 if len(sys.argv)<2:
  print("Usage: python3 scripts/verify_export_meshes.py DIRECTORY [MODEL ...]",file=sys.stderr)
  raise SystemExit(2)
 BASE=pathlib.Path(sys.argv[1]).expanduser().resolve()
 if not BASE.is_dir():raise SystemExit("Directory does not exist: "+str(BASE))
 models=sys.argv[2:] or ["ake","akc","dpe","dqf","aqp","akh","alf","alp","aap","rkn","rap","ama","amd","aga","pag","pmc","pga"]
 failed=False
 for model in models:
  result=check(model)
  if result["largest_axis_disagreement_m"]>0.002:failed=True
 if failed:raise SystemExit(1)
