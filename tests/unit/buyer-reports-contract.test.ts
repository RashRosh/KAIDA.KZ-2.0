import { expect, it } from 'vitest';
import { REPORT_REASONS, resolveReportSchema, submitReportSchema } from '../../src/modules/moderation/contracts/report.contract';

const base={submissionId:'a9040000-0000-4000-8000-000000000001',offerId:'a9040000-0000-4000-8000-000000000002',version:'a'.repeat(64),locale:'ru'};
it('every reason permits empty text; text is trimmed and bounded; caller cannot supply evidence or identity',()=>{
  for(const reason of REPORT_REASONS) expect(submitReportSchema.parse({...base,reason,text:'  '})).toMatchObject({text:''});
  expect(submitReportSchema.parse({...base,reason:'other',text:'  '+ 'я'.repeat(300)+'  '}).text).toHaveLength(300);
  expect(submitReportSchema.safeParse({...base,reason:'other',text:'я'.repeat(301)}).success).toBe(false);
  for(const extra of [{evidence:{}},{reporterUserId:base.offerId},{reason:'unknown'},{photoId:base.offerId}])
    expect(submitReportSchema.safeParse({...base,reason:'other',...extra}).success).toBe(false);
});
it('requires an independently chosen removal reason and private rationale for return/no action',()=>{
  const token='a'.repeat(64);
  expect(resolveReportSchema.safeParse({token,disposition:'removed'}).success).toBe(false);
  expect(resolveReportSchema.safeParse({token,disposition:'removed',reason:'other'}).success).toBe(true);
  for(const disposition of ['returned','no_action']) {
    expect(resolveReportSchema.safeParse({token,disposition,rationale:'  '}).success).toBe(false);
    expect(resolveReportSchema.safeParse({token,disposition,rationale:'Проверено',sellerComment:'Private buyer text'}).success).toBe(false);
    expect(resolveReportSchema.safeParse({token,disposition,rationale:'Проверено'}).success).toBe(true);
  }
});
