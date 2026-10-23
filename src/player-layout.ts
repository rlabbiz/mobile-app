export function fitVideoFrame(width:number,height:number,ratio:number|null){
  if(width<=0||height<=0||!Number.isFinite(width)||!Number.isFinite(height))return null;
  if(!ratio||!Number.isFinite(ratio)||ratio<=0)return {left:0,top:0,width,height};
  const videoWidth=Math.min(width,height*ratio),videoHeight=videoWidth/ratio;
  return {left:(width-videoWidth)/2,top:(height-videoHeight)/2,width:videoWidth,height:videoHeight};
}
export function playerBottomPadding(inset:number,handled:boolean){return 6+(handled?0:Math.max(0,inset));}
