import type {Part} from '@/lib/types';
import {Euler,Matrix4,Vector3} from 'three';
export type CadView='front'|'side'|'top'|'bottom';
export function cadMeshVolume(part:Part):number {
  if(part.shape?.kind!=='cad-mesh')return part.visible.length*part.visible.width*part.visible.thickness;
  const {positions:p,indices}=part.shape;let sum=0;
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    sum+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);}
  return Math.abs(sum/6)*part.visible.length*part.visible.width*part.visible.thickness;
}
/** Shared outline path for orthographic, part and printable drawings. */
export function cadMeshLoops(part:Part,view:CadView):Array<Array<{x:number;y:number}>>{
  if(part.shape?.kind!=='cad-mesh')return [];
  const r=part.rotation??{x:0,y:0,z:0};
  const matrix=new Matrix4().makeRotationFromEuler(new Euler(r.x,r.y,r.z,'ZYX'));
  const normal=view==='side'?new Vector3(1,0,0):view==='front'?new Vector3(0,0,1):new Vector3(0,1,0);
  normal.applyMatrix4(matrix.clone().invert());
  const localView=Math.abs(normal.x)>Math.max(Math.abs(normal.y),Math.abs(normal.z))?'side':Math.abs(normal.y)>Math.abs(normal.z)?'top':'front';
  const dims=[part.visible.length,part.visible.thickness,part.visible.width];
  const height=Math.abs(matrix.elements[1])*dims[0]+Math.abs(matrix.elements[5])*dims[1]+Math.abs(matrix.elements[9])*dims[2];
  return part.shape.outlines[localView].map(loop=>loop.map(p=>{
    const v=new Vector3(p[0]*dims[0],p[1]*dims[1],p[2]*dims[2]).applyMatrix4(matrix);
    v.add(new Vector3(part.origin.x,part.origin.y+height/2,part.origin.z));
    return view==='side'?{x:-v.z,y:v.y}:view==='front'?{x:-v.x,y:v.y}:{x:-v.x,y:v.z};
  }));
}
/** Bridge holes without filling the U of the arm ring; legacy callers accept one polygon. */
export function cadMeshPolygon(part:Part,view:CadView){
  const loops=cadMeshLoops(part,view);let polygon=loops[0]?.slice()??[];
  for(const hole of loops.slice(1)){
    let a=0,b=0,d=Infinity;
    polygon.forEach((p,i)=>hole.forEach((q,j)=>{const dd=(p.x-q.x)**2+(p.y-q.y)**2;if(dd<d){d=dd;a=i;b=j;}}));
    const cycle=[...hole.slice(b),...hole.slice(0,b),hole[b]];
    polygon=[...polygon.slice(0,a+1),...cycle,polygon[a],...polygon.slice(a+1)];
  }
  return polygon;
}
