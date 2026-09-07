import type {FurnitureTemplate,OptionSpec,Part} from '@/lib/types';
import source from './assets/six-slat-chair.json';
import edgeSource from './assets/six-slat-chair-edges.json';
import {chairControls,extraChairOptions} from './six-slat-chair-options';
import {chairTransform} from './six-slat-chair-transform';

export const sixSlatChairOptions:OptionSpec[]=[
  {group:'top',type:'number',key:'chairScoop',label:'座凹深度 (mm)',defaultValue:16,min:8,max:20,step:1,help:'整塊座板向下挖凹；板緣與尖翹等高。'},
  {group:'back',type:'number',key:'chairLumbar',label:'腰弧前托量 (mm)',defaultValue:20,min:10,max:30,step:1,help:'固定六枝背條，兩端保持接圈與座板。'},
  ...extraChairOptions,
];
const names:Record<string,string>={Arm_ring:'圈扶手',Rear_leg_L:'左後腳・直通圈',Rear_leg_R:'右後腳・直通圈',Front_leg_L:'左前腳',Front_leg_R:'右前腳',Side_apron_R:'右側撐',Side_apron_L:'左側撐',Front_arm_post_L:'左前支柱',Front_arm_post_R:'右前支柱',Front_rail:'前橫撐',Rear_rail:'後橫撐',Seat_support_1:'前座板支承',Seat_support_2:'後座板支承',Solid_scooped_seat:'整塊凹面座板'};
/** Source CAD uses Z-up; Part uses Y-up, with positions normalized to its own box. */
export const sixSlatChair:FurnitureTemplate=(input)=>{
  const warnings:string[]=[];
  const number=(raw:unknown,fallback:number,min:number,max:number,label:string)=>{
    const n=Number(raw??fallback),value=Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
    if(value!==n)warnings.push(`${label}已調整至 ${value} mm（試作範圍 ${min}–${max}）。`);
    return value;
  };
  const width=number(input.length,544,510,580,'座板寬'),depth=number(input.width,460,430,480,'座板深'),height=number(input.height,400,370,420,'板緣高');
  const scoop=number(input.options?.chairScoop,16,8,20,'座凹深度'),lumbar=number(input.options?.chairLumbar,20,10,30,'腰弧前托量');
  const scale=[width/544,depth/460,height/400];
  const values:Record<string,number>={};
  for(const [key,,label,,fallback,min,max] of chairControls)values[key]=number(input.options?.[key],fallback,min,max,label);
  const safeScoop=Math.min(scoop,(values.chairSeatThickness-14)*scale[2]);
  if(safeScoop<scoop)warnings.push(`座凹深度限制為 ${safeScoop.toFixed(1)} mm，以保留至少 14 mm 基準底厚。`);
  const rear=source.parts.find(p=>p.id==='Rear_leg_R')!;
  const rearX=(Math.max(...rear.positions.filter((_,i)=>i%3===0))+Math.min(...rear.positions.filter((_,i)=>i%3===0)))/2;
  const transform=chairTransform(values,rearX);
  const parts:Part[]=source.parts.map(raw=>{
    let bottom=Infinity,top=-Infinity;
    for(let i=2;i<raw.positions.length;i+=3){bottom=Math.min(bottom,raw.positions[i]);top=Math.max(top,raw.positions[i]);}
    const morph=(point:number[])=>{
      let [x,y,z]=point;
      if(raw.id==='Solid_scooped_seat'&&z>380&&z<399.9999)z=400-(400-z)*safeScoop/scale[2]/16;
      if(raw.id.startsWith('Back_slat_')){
        const t=Math.max(0,Math.min(1,(z-bottom)/(top-bottom)));
        const peak=values.chairLumbarPeak/100;
        const phase=t<=peak?t/(2*peak):.5+(t-peak)/(2*(1-peak));
        y-=lumbar/scale[1]*Math.sin(Math.PI*phase)**2-20*Math.sin(Math.PI*t)**2;
        const r=(1-(284/300)**2)*((x/245)**2+((y-275)/160)**2);
        const old=684-300*Math.sqrt(Math.max(0,1-r));
        z+=Math.max(0,400-old)*(1-safeScoop/scale[2]/16)*(1-t)**4;
      }
      const q=transform.apply(raw.id,[x,y,z],point);
      return [q[0]*scale[0],q[2]*scale[2],q[1]*scale[1]];
    };
    const vertices:number[][]=[];
    for(let i=0;i<raw.positions.length;i+=3)vertices.push(morph(raw.positions.slice(i,i+3)));
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const v of vertices)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[a]);max[a]=Math.max(max[a],v[a]);}
    const size=max.map((v,i)=>v-min[i]),center=max.map((v,i)=>(v+min[i])/2);
    const normalize=(p:number[])=>p.map((v,i)=>(v-center[i])/size[i]);
    const positions=vertices.flatMap(normalize),indices=raw.indices.slice();
    for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const outlines={} as Record<'front'|'side'|'top',number[][][]>;
    for(const view of ['front','side','top'] as const)outlines[view]=raw.outlines[view].map(loop=>loop.map(p=>normalize(morph(p))));
    return {id:raw.id,nameZh:names[raw.id]??`腰弧背條 ${raw.id.replace('Back_slat_','')}`,nameEn:raw.id.replaceAll('_',' '),material:input.material,grainDirection:'length',
      visible:{length:size[0],thickness:size[1],width:size[2]},origin:{x:center[0],y:min[1],z:center[2]},
      shape:{kind:'cad-mesh',positions,indices,outlines,wireCurves:(edgeSource as Record<string,number[][][]>)[raw.id].map(curve=>curve.map(p=>normalize(morph(p))))},tenons:[],mortises:[]};
  });
  // Four rail-to-leg blind tenons. The raked rear leg is narrower at rail height.
  // Provisional 12 mm engagement preserves stock in these slender legs (§B2).
  for(const end of ['Front','Rear'] as const) {
    const rail=parts.find(p=>p.id===`${end}_rail`)!;
    rail.shape={kind:'box'};
    rail.visible.length=2*(end==='Front'?272-values.chairFrontLeg/2:transform.rearAtRail[0]-transform.rearHalf(328+transform.railShift))*scale[0];
    for(const [sign,label] of [[-1,'L'],[1,'R']] as const) {
      const leg=parts.find(p=>p.id===`${end}_leg_${label}`)!;
      const length=values.chairTenonLength*scale[0],w=values.chairTenonWidth*scale[1],h=values.chairTenonHeight*scale[2];
      rail.tenons.push({position:sign<0?'start':'end',type:'blind-tenon',length,width:w,thickness:h});
      leg.mortises.push({origin:{x:sign*rail.visible.length/2-leg.origin.x,y:rail.origin.y+rail.visible.thickness/2-leg.origin.y,z:rail.origin.z-leg.origin.z},depth:length,length:h,width:w,through:false,shape:'rect',label:`${end==='Front'?'前':'後'}橫撐盲榫（試配）`});
    }
  }
  const overall={length:Math.max(...parts.map(p=>2*Math.abs(p.origin.x)+p.visible.length)),width:Math.max(...parts.map(p=>p.origin.z+p.visible.width/2))-Math.min(...parts.map(p=>p.origin.z-p.visible.width/2)),thickness:Math.max(...parts.map(p=>p.origin.y+p.visible.thickness))};
  return {id:'six-slat-chair-v3',category:'six-slat-chair',nameZh:input.locale==='en'?'Six-slat horseshoe chair':'六柱圈椅・本機試作',overall,parts,primaryMaterial:input.material,defaultJoinery:'dowel',useButtJointConvention:true,
    notes:input.locale==='en'?'Local CAD shape prototype. Stock figures are axis-aligned envelopes, not final cutting dimensions. Joinery and bending stock remain to be designed.':'本機造型試作：寬、深、板緣高按比例連動構件。六枝背條、後腳直通圈、懸浮實板保留。材料／裁切數字目前是外形包絡估算；圈扶手彎料展開、順紋毛料與榫卯未定稿，不能直接下料。',warnings};
};
