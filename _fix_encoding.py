"""Fix garbled Chinese in Codex JSONL and overwrite original.
Usage: python _fix_encoding.py [input.jsonl] [output.jsonl]
"""

import json
import sys
import io
import os
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PUA_PATTERN = re.compile(r'[\ue000-\uf8ff]')
CJK_PATTERN = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]')


def is_likely_garbled(text):
    if not text:
        return False
    if PUA_PATTERN.search(text):
        return True
    cjk_chars = len(CJK_PATTERN.findall(text))
    total = len(text)
    if cjk_chars == 0:
        return False
    try:
        recovered = text.encode('gbk', errors='replace').decode('utf-8', errors='replace')
        rec_cjk = len(CJK_PATTERN.findall(recovered))
        rec_total = len(recovered)
        orig_ratio = cjk_chars / max(total, 1)
        changed = sum(1 for a, b in zip(text, recovered) if a != b)
        change_ratio = changed / max(len(text), 1)
        if orig_ratio > 0.30 and change_ratio > 0.20:
            return True
    except:
        pass
    return False


def recover_text(text):
    if not is_likely_garbled(text):
        return text
    try:
        return text.encode('gbk', errors='replace').decode('utf-8', errors='replace')
    except:
        return text


def fix_jsonl(input_path, output_path):
    fixed_count = 0
    total_lines = 0

    with open(input_path, 'r', encoding='utf-8') as fin, \
         open(output_path, 'w', encoding='utf-8') as fout:

        for line in fin:
            total_lines += 1
            line = line.strip()
            if not line:
                fout.write('\n')
                continue

            try:
                obj = json.loads(line)
                p = obj.get('payload', {})

                if isinstance(p, dict) and p.get('type') == 'function_call_output':
                    old_output = p.get('output', '')
                    if is_likely_garbled(old_output):
                        new_output = recover_text(old_output)
                        if new_output != old_output:
                            p['output'] = new_output
                            fixed_count += 1

                fout.write(json.dumps(obj, ensure_ascii=False) + '\n')
            except json.JSONDecodeError:
                fout.write(line + '\n')

    return fixed_count, total_lines


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    elif len(sys.argv) >= 2:
        input_path = sys.argv[1]
        output_path = input_path  # overwrite
    else:
        input_path = r"C:\Users\Administrator\.codex\sessions\2026\05\24\rollout-2026-05-24T21-28-11-019e5a2b-e47b-7030-af9f-6b94bd647340.jsonl"
        output_path = input_path + ".fixed"

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    fixed, total = fix_jsonl(input_path, output_path)
    print(f"Fixed {fixed}/{total} lines")

    if output_path != input_path:
        print(f"\nTo replace original, run:")
        print(f'  Copy-Item -Path "{output_path}" -Destination "{input_path}" -Force')