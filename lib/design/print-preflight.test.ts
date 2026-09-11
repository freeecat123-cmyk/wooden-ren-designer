import { expect, it } from 'vitest';
import { getPrintSavedState } from './print-preflight';
import { getTemplate } from '@/lib/templates';
import { savedDesignQuery } from './saved-query';
import { designParamsToQuery, parseDesignSearchParams } from './parse-search-params';
const params={length:900,width:600,height:750,material:'pine',joineryMode:false,designerMode:false};
const saved={params,furniture_type:'table',updated_at:'v1'};
const sp={designId:'owned',revision:'v1',length:'900',width:'600',height:'750',material:'pine',joineryMode:'false',designerMode:'false'};
it('only reports matching after verified owned data matches parameters and revision',()=>{
  expect(getPrintSavedState('table',sp,saved,[],{})).toBe('matching');
  expect(getPrintSavedState('table',{...sp,length:'1000'},saved,[],{})).toBe('changed');
  expect(getPrintSavedState('table',{...sp,revision:'old'},saved,[],{})).toBe('changed');
});
it('does not trust an ID alone or another template',()=>{
  expect(getPrintSavedState('table',sp,null,[],{})).toBe('unverified');
  expect(getPrintSavedState('table',{},null,[],{})).toBe('unsaved');
  expect(getPrintSavedState('table',sp,{...saved,furniture_type:'chair'},[],{})).toBe('unverified');
});

it('matches legacy stool parameters after the editor expands missing defaults', () => {
  const entry = getTemplate('stool')!;
  const legacy = { length: 340, width: 330, height: 420, material: 'pine',
    legShape: 'splayed', legSize: 28, legInset: 30, splayAngle: 4.5,
    seatEdge: 7, seatThickness: 25, withLowerStretcher: true };
  const opened = Object.fromEntries(savedDesignQuery('owned', legacy));
  const query = { ...Object.fromEntries(designParamsToQuery(parseDesignSearchParams(opened, entry), entry)), designId: 'owned', revision: 'v1' };
  const schema = entry.optionSchema ?? [];
  const defaults = { ...entry.defaults, material: 'pine', ...Object.fromEntries(schema.map(s => [s.key, s.defaultValue])) };
  const record = { params: legacy, furniture_type: 'stool', updated_at: 'v1' };
  const check = (q: typeof query) => getPrintSavedState('stool', q, record, schema.map(s => s.key), defaults);
  expect(check(query)).toBe('matching');
  for (const change of [{ length: '341' }, { seatEdge: '8' }, { seatCornerR: '10' },
    { constructionVersion: '2' }, { revision: 'v2' }, { joineryMode: 'true' }]) {
    expect(check({ ...query, ...change })).toBe('changed');
  }
  expect(getPrintSavedState('stool', query, { ...record, params: { ...legacy, _modelSnapshot: {} } },
    schema.map(s => s.key), defaults)).toBe('changed');
});
