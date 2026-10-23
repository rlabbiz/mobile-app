import {fitVideoFrame,playerBottomPadding} from '../src/player-layout';
test.each([[1920/1032,390,844],[9/16,390,844],[1,360,640]])('fits aspect %s inside %sx%s without cropping',(ratio,width,height)=>{
 const frame=fitVideoFrame(width,height,ratio)!;expect(frame.width/frame.height).toBeCloseTo(ratio);expect(frame.width).toBeLessThanOrEqual(width);expect(frame.height).toBeLessThanOrEqual(height);expect(frame.left).toBeGreaterThanOrEqual(0);expect(frame.top).toBeGreaterThanOrEqual(0);
});
test('waits for dimensions and keeps an unknown-size video within its viewport',()=>{expect(fitVideoFrame(0,0,null)).toBeNull();expect(fitVideoFrame(390,844,null)).toEqual({left:0,top:0,width:390,height:844});});
test('applies the system bottom inset only once in fullscreen and leaves tab-bar screens compact',()=>{expect(playerBottomPadding(34,false)).toBe(40);expect(playerBottomPadding(34,true)).toBe(6);});
