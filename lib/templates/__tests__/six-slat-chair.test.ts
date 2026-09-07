import {describe,it,expect} from 'vitest';
import {sixSlatChair} from '../six-slat-chair';
import {partExportGeometry} from '@/lib/export/three-d-export';
import {cadMeshLoops,cadMeshVolume} from '@/lib/render/cad-mesh';
import {projectPartPolygon,projectPartSilhouette,pointInPolygon} from '@/lib/render/geometry';
import {estimateWeight} from '@/lib/design/shipping';
import {deriveBuildSteps} from '@/lib/steps/derive';
import {translateSteps} from '@/lib/steps/translations';
import {partFlatOutline} from '@/lib/export/parts-svg';
import {mortiseLocalBox,tenonLocalBox} from '@/lib/render/svg-views';
import {chairControls} from '../six-slat-chair-options';
import rawParts from '../assets/six-slat-chair.json';
import {chairTransform} from '../six-slat-chair-transform';
import type {FurnitureDesign,FurnitureTemplateInput} from '@/lib/types';
const input:FurnitureTemplateInput={length:544,width:460,height:400,material:'pine'};
function check(d:FurnitureDesign){
  expect(d.parts).toHaveLength(20);
  expect(d.parts.filter(p=>p.id.startsWith('Back_slat_'))).toHaveLength(6);
  const ring=d.parts.find(p=>p.id==='Arm_ring')!;
  for(const method of [projectPartPolygon,projectPartSilhouette]){
    const polygon=method(ring,'top');
    expect(polygon.length).toBeGreaterThan(15);
    expect(pointInPolygon({x:0,y:250},polygon)).toBe(false);
  }
  for(const id of ['Side_apron_L','Side_apron_R'])expect(cadMeshLoops(d.parts.find(p=>p.id===id)!,'side').length).toBeGreaterThanOrEqual(3);
  for(const p of d.parts){
    for (const mode of ['printable','mortise-accurate','joinery-accurate'] as const) {
    const g=partExportGeometry(p,mode);
    const pos=g.getAttribute('position');expect(pos.count).toBeGreaterThan(3);expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);g.dispose();
    }
    for(const view of ['front','side','top'] as const)expect(projectPartPolygon(p,view).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  }
}
describe('native six-slat chair template',()=>{
  it('assigns the pointed nose to the front leg, with a shared apron mating face',()=>{
    const values=Object.fromEntries(chairControls.map(([key,,, ,value])=>[key,value]));
    Object.assign(values,{chairFrontLeg:28,chairRingWidth:560,chairRingHeight:765,chairSeatThickness:30,chairApronCurve:5});
    const rear=rawParts.parts.find(p=>p.id==='Rear_leg_R')!;
    const xs=rear.positions.filter((_,i)=>i%3===0),rx=(Math.min(...xs)+Math.max(...xs))/2;
    const morph=chairTransform(values,rx);
    for(const side of ['L','R']) {
      const apron=rawParts.parts.find(p=>p.id===`Side_apron_${side}`)!;
      expect(Math.min(...apron.positions.filter((_,i)=>i%3===1))).toBeGreaterThanOrEqual(21.999);
      expect(Math.max(...apron.positions.filter((_,i)=>i%3===2))).toBeLessThanOrEqual(354.001);
      const leg=rawParts.parts.find(p=>p.id===`Front_leg_${side}`)!;
      expect(Math.max(...leg.positions.filter((_,i)=>i%3===2))).toBeCloseTo(400);
      const sign=side==='L'?-1:1;
      for(const z of [306,328,354]) {
        const p=[sign*270,22,z];
        expect(morph.apply(`Front_leg_${side}`,p)).toEqual(morph.apply(`Side_apron_${side}`,p));
      }
    }
  });
  it.each(chairControls)('%s changes geometry without losing six slats or producing invalid vertices',(key,group,label,en,defaultValue,min,max)=>{
    const a=sixSlatChair(input),b=sixSlatChair({...input,options:{[key]:max}});
    expect(b.parts).not.toEqual(a.parts);
    expect(b.parts.filter(p=>p.id.startsWith('Back_slat_'))).toHaveLength(6);
    for(const p of b.parts) {
      expect(Object.values(p.visible).every(n=>Number.isFinite(n)&&n>0)).toBe(true);
      if(p.shape?.kind==='cad-mesh')expect(p.shape.positions.every(Number.isFinite)).toBe(true);
    }
  });
  it('keeps the solid seat rim fixed while moving its underside and supports',()=>{
    const d=sixSlatChair({...input,options:{chairSeatThickness:40,chairSeatReveal:18}});
    const seat=d.parts.find(p=>p.id==='Solid_scooped_seat')!,support=d.parts.find(p=>p.id==='Seat_support_1')!,rail=d.parts.find(p=>p.id==='Front_rail')!;
    expect(seat.origin.y).toBeCloseTo(360);expect(seat.origin.y+seat.visible.thickness).toBeCloseTo(400);
    expect(support.origin.y+support.visible.thickness).toBeCloseTo(360);
    expect(rail.origin.y+rail.visible.thickness).toBeCloseTo(342);
  });
  it('limits a thin seat hollow visibly',()=>{
    expect(sixSlatChair({...input,options:{chairSeatThickness:30,chairScoop:20}}).warnings?.join(' ')).toContain('14 mm');
  });
  it('uses six continuous CAD curves per round member, without tessellation fragments',()=>{
    const d=sixSlatChair(input);
    for(const p of d.parts.filter(p=>/^(Arm_ring|Back_slat_|Front_arm_post_)/.test(p.id))) {
      if(p.shape?.kind!=='cad-mesh')throw Error(p.id);
      expect(p.shape.wireCurves,p.id).toHaveLength(6);
      const dims=[p.visible.length,p.visible.thickness,p.visible.width];
      for(const curve of p.shape.wireCurves!) {
        expect(curve.length).toBeGreaterThan(8);
        for(let i=1;i<curve.length;i++) expect(Math.hypot(...curve[i].map((x,j)=>(x-curve[i-1][j])*dims[j]))).toBeLessThan(8);
      }
    }
  });
  it('pairs four rail tenons with real matching cut volumes',()=>{
    const d=sixSlatChair(input);
    expect(d.parts.reduce((n,p)=>n+p.tenons.length,0)).toBe(4);
    expect(d.parts.reduce((n,p)=>n+p.mortises.length,0)).toBe(4);
    for(const end of ['Front','Rear']) for(const [i,label] of ['L','R'].entries()) {
      const rail=d.parts.find(p=>p.id===`${end}_rail`)!,leg=d.parts.find(p=>p.id===`${end}_leg_${label}`)!;
      const t=tenonLocalBox(rail,rail.tenons[i]),m=mortiseLocalBox(leg,leg.mortises[0]);
      expect(t.cx+rail.origin.x).toBeCloseTo(m.cx+leg.origin.x,6);
      expect(t.cy+rail.origin.y+rail.visible.thickness/2).toBeCloseTo(m.cy+leg.origin.y+leg.visible.thickness/2,6);
      expect(t.cz+rail.origin.z).toBeCloseTo(m.cz+leg.origin.z,6);
      expect([t.hx,t.hy,t.hz]).toEqual([m.hx,m.hy,m.hz]);
    }
  });
  it('uses shaped outlines in the native full-size template export',()=>{
    const d=sixSlatChair(input);
    for(const id of ['Arm_ring','Side_apron_L','Solid_scooped_seat']) {
      const outline=partFlatOutline(d.parts.find(p=>p.id===id)!);
      expect(outline.pts.length,id).toBeGreaterThan(id==='Solid_scooped_seat' ? 3 : 15);
      expect(outline.w).toBeGreaterThan(400);
      expect(outline.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
    }
  });
  it('keeps six slats, both apron openings and the U-shaped ring across all outputs',()=>check(sixSlatChair(input)));
  it('keeps the rim at 400 and uses actual mesh volume for weight',()=>{
    const d=sixSlatChair(input),seat=d.parts.find(p=>p.id==='Solid_scooped_seat')!;
    expect(seat.origin.y+seat.visible.thickness).toBeCloseTo(400,3);
    expect(seat.visible.length).toBeCloseTo(544,3);
    expect(seat.visible.width).toBeCloseTo(460,3);
    // Independently measured STEP volume: 13,235,631 mm3 (2% tessellation tolerance).
    const volume=d.parts.reduce((sum,p)=>sum+cadMeshVolume(p),0);
    expect(volume).toBeGreaterThan(12970918);expect(volume).toBeLessThan(13500344);
    expect(estimateWeight(d)).toBeGreaterThan(6);expect(estimateWeight(d)).toBeLessThan(6.5);
  });
  it.each([{length:510,width:430,height:370,options:{chairScoop:8,chairLumbar:10}},{length:580,width:480,height:420,options:{chairScoop:20,chairLumbar:30}}])('supports range boundary %j',v=>check(sixSlatChair({...input,...v})));
  it('changes curves without changing rear-leg straight geometry',()=>{
    const a=sixSlatChair(input),b=sixSlatChair({...input,options:{chairScoop:12,chairLumbar:28}});
    for(const id of ['Rear_leg_L','Rear_leg_R'])expect(b.parts.find(p=>p.id===id)).toEqual(a.parts.find(p=>p.id===id));
    expect(b.parts.find(p=>p.id==='Back_slat_3')?.shape).not.toEqual(a.parts.find(p=>p.id==='Back_slat_3')?.shape);
  });
  it('rejects invalid dimensions visibly and includes shaping labor in both languages',()=>{
    expect(sixSlatChair({...input,length:-10}).warnings?.length).toBeGreaterThan(0);
    const d=sixSlatChair(input),steps=deriveBuildSteps(d),shape=steps.find(s=>s.id==='six-slat-shaping');
    expect(shape?.estimatedMinutes).toBe(240);
    expect(translateSteps(steps,d,'en').find(s=>s.id==='six-slat-shaping')?.title).toBe('Lay out curves and verify the prototype');
  });
  it('the acceptance probe detects deliberately broken count and filled ring',()=>{
    const broken=sixSlatChair(input);broken.parts=broken.parts.slice(1);expect(()=>check(broken)).toThrow();
    const filled=sixSlatChair(input);const ring=filled.parts.find(p=>p.id==='Arm_ring')!;
    if(ring.shape?.kind==='cad-mesh')ring.shape.outlines.top=[[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5]]];
    expect(()=>check(filled)).toThrow();
  });
});
