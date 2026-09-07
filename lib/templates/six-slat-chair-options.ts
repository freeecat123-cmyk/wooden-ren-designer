import type {OptionSpec} from '@/lib/types';
// Values describe the 544 × 460 × 400 reference; the three main dimensions scale it.
export const chairControls = [
  ['chairRingHeight','structure','圈扶手後側總高','Ring rear height',800,760,840,5],
  ['chairArmRise','structure','扶手前端升降','Arm front height adjustment',0,-20,20,2],
  ['chairRingWidth','structure','圈扶手外寬','Ring outside width',580,560,610,5],
  ['chairRingDepth','structure','圈扶手前後深度','Ring depth',528,508,548,5],
  ['chairRingDiameter','structure','圈扶手截面直徑','Ring section diameter',36,30,42,1],
  ['chairBackSpread','back','背條排列寬度（中心距）','Slat array width',380,340,400,5],
  ['chairBackSize','back','背條粗細（%）','Slat section size (%)',100,85,120,5],
  ['chairBackLean','back','靠背後傾增量（°）','Additional back rake (degrees)',0,-2,4,1],
  ['chairLumbarPeak','back','腰弧最高點（背條高度 %）','Lumbar peak height (%)',50,35,65,5],
  ['chairFrontLeg','leg','前腳截面寬','Front leg section',30,28,36,1],
  ['chairRearTop','leg','後腳上端截面寬','Rear leg upper section',30,28,34,1],
  ['chairRearBottom','leg','後腳下端截面寬','Rear leg lower section',18,16,22,1],
  ['chairRearSplay','leg','後腳落地點前後調整','Rear foot offset',0,-15,20,1],
  ['chairPostBow','leg','前支柱向前彎增量','Additional front post bow',0,-4,12,1],
  ['chairSeatThickness','top','座板厚度','Seat thickness',34,30,40,1],
  ['chairSeatOffset','top','座板前後移動','Seat fore-aft offset',0,-8,8,1],
  ['chairSeatReveal','top','座板底與橫撐間距','Seat underside to rail gap',12,8,18,1],
  ['chairApronThickness','apron','側撐厚度','Side apron thickness',24,22,28,1],
  ['chairApronCurve','apron','側撐下緣弧度增量','Additional apron lower curve',0,-5,5,1],
  ['chairTenonLength','joinery','橫撐榫長','Rail tenon length',12,8,14,1],
  ['chairTenonWidth','joinery','橫撐榫厚','Rail tenon thickness',10,8,12,1],
  ['chairTenonHeight','joinery','橫撐榫寬','Rail tenon height',28,24,32,1],
] as const;
export const extraChairOptions:OptionSpec[]=chairControls.map(([key,group,label,,defaultValue,min,max,step])=>({key,group,type:'number',label,defaultValue,min,max,step,
  help:group==='joinery'?'僅調整已建立的四組橫撐盲榫；榫孔同步，仍為試配。':'以基準座板 544×460、板緣高 400 mm 設定；主尺寸會再按比例縮放。'}));
