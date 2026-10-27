import pathlib,json,statistics,hashlib
R=pathlib.Path(__file__).parent
def summarize(base):
    a=json.loads((base/'asr-results.json').read_text(encoding='utf8'));e=json.loads((base/'extraction-results.json').read_text(encoding='utf8'));out={'asr':[],'extraction':[],'runtime':json.loads((base/'extraction-runtime.json').read_text())}
    for runtime in sorted({x['runtime'] for x in a}):
        rows=[x for x in a if x['runtime']==runtime];groups={}
        for lang in ['ru','kk','mixed']:
            g=[x for x in rows if x['lang']==lang];groups[lang]=sum(x['word_errors'] for x in g)/sum(x['reference_words'] for x in g)
        out['asr'].append({'runtime':runtime,'cases':len(rows),'failures':sum(x['exit']!=0 for x in rows),'wer':sum(x['word_errors'] for x in rows)/sum(x['reference_words'] for x in rows),'wer_by_language':groups,'median_wall_s':statistics.median(x['wall_s'] for x in rows),'max_wall_s':max(x['wall_s'] for x in rows),'total_wall_s':sum(x['wall_s'] for x in rows),'peak_rss_mib':max(x['peak_rss_mib'] for x in rows),'peak_private_mib':max(x['peak_private_mib'] for x in rows),'min_host_available_mib':min(x['min_host_available_mib'] for x in rows)})
    for model in sorted({x['model'] for x in e}):
        for source in sorted({x['source'] for x in e}):
            rows=[x for x in e if x['model']==model and x['source']==source]
            out['extraction'].append({'model':model,'source':source,'cases':len(rows),'field_correct':sum(x['field_correct'] for x in rows),'field_total':sum(x['field_total'] for x in rows),'field_accuracy':sum(x['field_correct'] for x in rows)/sum(x['field_total'] for x in rows),'exact_cases':sum(x['field_correct']==x['field_total'] and not x['extra_items'] and not x['error'] for x in rows),'invented_missing_fields':sum(x['invented_missing_fields'] for x in rows),'unsupported_nonnull_fields':sum(x['unsupported_nonnull_fields'] for x in rows),'extra_items':sum(x['extra_items'] for x in rows),'invalid_or_truncated_outputs':sum(x['error'] is not None for x in rows),'median_wall_s':statistics.median(x['wall_s'] for x in rows),'max_wall_s':max(x['wall_s'] for x in rows),'peak_rss_mib':max(x['peak_rss_mib'] for x in rows)})
    return out
data={'robotic':summarize(R),'neural':summarize(R/'neural')}
(R/'summary.json').write_text(json.dumps(data,indent=2),encoding='utf8')
print(json.dumps(data['neural'],indent=2))
