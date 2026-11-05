export interface Technique {
  id:string
  title:string
  group:'서기'|'막기'|'지르기'|'차기'|'이동'
  english:string
  goal:string
  focus:string[]
  views:View[]
}
export type View = 'front'|'back'|'left'|'right'|'top'|'angle'
export const techniques:Technique[] = [
  {id:'B00',title:'준비서기',group:'서기',english:'Ready stance',goal:'시작 자세에서 양발과 주먹의 위치를 확인해요.',focus:['양발의 배치','골반과 몸통','손의 시작 위치'],views:['front','back']},
  {id:'B01',title:'앞서기',group:'서기',english:'Walking stance',goal:'앞발이 나가는 경로와 두 발이 바닥에 닿는 순간을 관찰해요.',focus:['앞발의 위치','디딤의 순서','골반의 이동'],views:['angle','top']},
  {id:'B02',title:'주춤서기',group:'서기',english:'Riding stance',goal:'두 발을 벌릴 때 무릎과 몸통이 어떻게 움직이는지 살펴봐요.',focus:['양발의 간격','양쪽 무릎','상체의 정렬'],views:['front','angle']},
  {id:'B03',title:'앞굽이',group:'서기',english:'Front stance',goal:'앞굽이의 디딤과 앞서기의 발 배치 차이를 비교해요.',focus:['앞 무릎','뒤쪽 발의 지지','골반의 이동'],views:['left','top']},
  {id:'B04',title:'아래막기',group:'막기',english:'Low block',goal:'막는 팔의 경로와 반대 손이 돌아오는 위치를 함께 봐요.',focus:['막는 팔','회수하는 손','끝 자세'],views:['front','angle']},
  {id:'B05',title:'몸통 안막기',group:'막기',english:'Inward middle block',goal:'팔이 안쪽으로 움직일 때 손목과 팔꿈치를 확인해요.',focus:['팔꿈치','손목 경로','반대쪽 주먹'],views:['front','top']},
  {id:'B06',title:'얼굴막기',group:'막기',english:'High block',goal:'막는 팔이 올라가는 경로와 얼굴 앞 시야를 살펴봐요.',focus:['올라가는 팔','얼굴과 팔의 관계','시선'],views:['front','left']},
  {id:'B07',title:'몸통 지르기',group:'지르기',english:'Middle punch',goal:'나가는 주먹과 돌아오는 주먹, 앞발의 관계를 함께 봐요.',focus:['지르는 주먹','반대 손 회수','앞발과 팔의 관계'],views:['angle','left']},
  {id:'B08',title:'앞차기',group:'차기',english:'Front kick',goal:'무릎 들기부터 뻗기, 회수와 착지까지 나누어 살펴봐요.',focus:['지지발','무릎과 발끝','회수 후 착지'],views:['left','back']},
  {id:'B09',title:'이동·방향 전환',group:'이동',english:'Step and turn',goal:'이동발과 지지발을 구분하고 전환 전후의 방향을 확인해요.',focus:['지지발','몸 방향','바닥 이동 경로'],views:['top','back']},
]
export const viewLabels:Record<View,string>={front:'정면',back:'후면',left:'왼쪽',right:'오른쪽',top:'위',angle:'사선'}
export const views:View[]=['front','back','left','right','top','angle']
export const labsTitle='이동·연결 테스트'
