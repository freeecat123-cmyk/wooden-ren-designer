import centers from './assets/six-slat-chair-centers.json';
type Point=number[];
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
function nearest(p:Point,curve:Point[]):Point {
  let best=curve[0],dist=Infinity;
  for(let i=1;i<curve.length;i++) {
    const a=curve[i-1],b=curve[i],v=b.map((x,j)=>x-a[j]);
    const t=clamp(v.reduce((n,x,j)=>n+x*(p[j]-a[j]),0)/v.reduce((n,x)=>n+x*x,0));
    const q=a.map((x,j)=>x+t*v[j]),d=q.reduce((n,x,j)=>n+(x-p[j])**2,0);
    if(d<dist){dist=d;best=q;}
  }
  return best;
}
const backRing=centers.ring.filter(p=>p[1]>350).sort((a,b)=>a[0]-b[0]);
function ringAt(x:number):Point {
  for(let i=1;i<backRing.length;i++)if(backRing[i][0]>=x){
    const a=backRing[i-1],b=backRing[i],t=clamp((x-a[0])/(b[0]-a[0]));
    return a.map((v,j)=>mix(v,b[j],t));
  }
  return backRing[backRing.length-1];
}
export function chairTransform(v:Record<string,number>,rearX:number) {
  const sx=v.chairRingWidth/580,dy=v.chairRingDepth/528;
  const lean=Math.tan(v.chairBackLean*Math.PI/180);
  const upper=(p:Point):Point=>[p[0]*sx,p[1]*dy+(p[2]-400)*lean,
    400+(p[2]-400)*(v.chairRingHeight-400)/400+v.chairArmRise*(1-p[1]/528)];
  const rearTop=upper([rearX,430,750]);
  const seatBottom=400-v.chairSeatThickness;
  const railTop=seatBottom-v.chairSeatReveal,railShift=railTop-354;
  const rearCenter=(z:number):Point=>[rearTop[0],mix(510+v.chairRearSplay,rearTop[1],z/rearTop[2]),z];
  const rearAtRail=rearCenter(328+railShift);
  const oldRearY=510-80*328/750;
  const lower=(p:Point):Point=>{
    const t=p[1]/oldRearY,sign=Math.sign(p[0]);
    return [p[0]+sign*(rearAtRail[0]-rearX)*t,p[1]+(rearAtRail[1]-oldRearY)*t,p[2]+railShift];
  };
  const apronPoint=(p:Point):Point=>{
    const [x,y,z]=p,sign=Math.sign(x),oldEnd=510-80*354/750,k=(rearX-272)/oldEnd;
    const center=sign*(272+k*y);
    const q=lower([center+(x-center)*v.chairApronThickness/24,y,z]);
    q[2]-=v.chairApronCurve*clamp((320-z)/60)*Math.sin(Math.PI*clamp(y/oldEnd));
    q[2]-=railShift*clamp((z-354)/46);
    return q;
  };
  return {
    railShift,rearAtRail,rearTop,seatBottom,
    rearHalf:(z:number)=>(mix(v.chairRearBottom,v.chairRearTop,z/rearTop[2]))/2,
    apply(id:string,p:Point,original:Point=p):Point {
      let [x,y,z]=p; const sign=Math.sign(x);
      if(id==='Arm_ring') {
        if(v.chairRingDiameter===36)return upper(p);
        const c=nearest(p,centers.ring),r=v.chairRingDiameter/36;
        return upper(p.map((n,i)=>c[i]+(n-c[i])*r));
      }
      if(id.startsWith('Rear_leg_')) {
        const t=z/750,old=9+6*t,r=mix(v.chairRearBottom,v.chairRearTop,t)/(2*old);
        const q=rearCenter(t*rearTop[2]);
        return [sign*q[0]+(x-sign*rearX)*r,q[1]+(y-(510-80*t))*r,q[2]];
      }
      if(id.startsWith('Front_leg_')) {
        const stem=[sign*272+(x-sign*272)*v.chairFrontLeg/30,y*v.chairFrontLeg/30,z];
        // The front branch now belongs to the leg. Its rear mating face at
        // source Y=22 shares the exact same deformation as the apron.
        const t=clamp(y/22)*clamp((z-300)/5),branch=apronPoint(p);
        return stem.map((n,i)=>mix(n,branch[i],t));
      }
      if(id.startsWith('Side_apron_')) {
        return apronPoint(p);
      }
      if(id.startsWith('Front_arm_post_')) {
        const t=clamp((z-337)/(626-337)),a=lower(p),b=upper(p);
        return [mix(a[0],b[0],t),mix(a[1],b[1],t)-v.chairPostBow*Math.sin(Math.PI*t)**2,mix(a[2],b[2],t)];
      }
      if(id==='Solid_scooped_seat') {
        // Keep the scooped surface and rim; only move the underside.
        const amount=clamp((384-original[2])/18);
        return [x,y+v.chairSeatOffset,z+(34-v.chairSeatThickness)*amount];
      }
      if(id.startsWith('Back_slat_')) {
        const n=Number(id.replace('Back_slat_',''))-1,curve=centers.slats[n];
        const t=clamp((p[2]-curve[0][2])/(curve[curve.length-1][2]-curve[0][2]));
        const r=v.chairBackSize/100,spread=v.chairBackSpread/380;
        const c=r===1?[curve[0][0],y,z]:nearest(p,curve);
        x=c[0]*spread+(x-c[0])*r; y=c[1]+(y-c[1])*r;
        const original=ringAt(c[0]),target=ringAt(c[0]*spread);
        y+=(target[1]-original[1])*t;z+=(target[2]-original[2])*t;
        const q=upper([x,y,z]);
        return [mix(x,q[0],t),mix(y+v.chairSeatOffset,q[1],t),mix(z,q[2],t)];
      }
      if(id.startsWith('Seat_support_')) {
        const q=lower(p);q[2]=railTop+(z-354)*v.chairSeatReveal/12;return q;
      }
      if(id==='Front_rail'||id==='Rear_rail')return lower(p);
      return p;
    },
  };
}
