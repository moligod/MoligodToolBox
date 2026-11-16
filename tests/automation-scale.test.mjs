import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmScale, rescaleScript} from '../src/automation-scale.ts';

const source = () => ({缩放:100,schemaVersion:1,name:'original',steps:[
  {delayMs:20,annotation:'keep',action:{type:'click',target:'A',x:200,y:300,holdMs:50}},
  {delayMs:0,action:{type:'group',name:'nested',steps:[
    {delayMs:0,action:{type:'drag',fromX:100,fromY:200,toX:300,toY:400,durationMs:500}},
    {delayMs:0,action:{type:'scroll',x:100,y:200,delta:-120}},
    {delayMs:0,action:{type:'ocr',region:{x:10,y:20,width:100,height:200}}},
    {delayMs:0,action:{type:'click',x:-1,y:-1}},
  ]}},
]});
test('import cancellation preserves script; acceptance updates baseline and all nested coordinates once', () => {
  const script=source(), original=structuredClone(script);
  let prompt='';
  assert.equal(confirmScale(script,150,text=>{prompt=text;return false}),false);
  assert.match(prompt,/检测到脚本使用者缩放不一样/);
  assert.deepEqual(script,original);
  assert.equal(confirmScale(script,150,()=>true),true);
  assert.equal(script.缩放,150);
  assert.equal(script.steps[0].action.x,300);
  assert.equal(script.steps[0].delayMs,20);
  assert.equal(script.steps[0].annotation,'keep');
  const children=script.steps[1].action.steps;
  assert.equal(children[0].action.toY,600);
  assert.equal(children[0].action.durationMs,500);
  assert.equal(children[1].action.delta,-120);
  assert.deepEqual(children[2].action.region,{x:15,y:30,width:150,height:300});
  assert.equal(children[3].action.x,-1);
  const once=structuredClone(script);
  confirmScale(script,150,()=>assert.fail('same scale must not prompt'));
  assert.deepEqual(script,once);
  rescaleScript(script,100);
  assert.deepEqual(script,original);
});
test('missing or corrupt source scale is not guessed', () => {
  for(const value of [undefined,0,-1,Infinity,1001,'125']) {
    const script={...source(),缩放:value};
    const original=structuredClone(script);
    assert.throws(()=>rescaleScript(script,150));
    assert.deepEqual(script,original);
  }
});

test('rescaling also visits queries nested inside condition values',()=>{
  const script={缩放:100,schemaVersion:2,steps:[{delayMs:0,action:{type:'holdUntil',timeoutMs:1000,intervalMs:100,expression:'false'},inputs:{schemaVersion:1,values:{expression:{kind:'not',value:{kind:'query',action:{type:'match',region:{x:10,y:20,width:100,height:200}}}}}}}]};
  rescaleScript(script,150);
  assert.deepEqual(script.steps[0].inputs.values.expression.value.action.region,{x:15,y:30,width:150,height:300});
  assert.equal(script.steps[0].action.timeoutMs,1000);
});
