# -*- coding: utf-8 -*-
"""中文字体子集化脚本。

扫描全站 HTML/CSS/JS 中实际用到的 CJK 字符（含全角标点），
从 Noto Serif SC 源字体切出子集，输出 woff2 到 fonts/ 目录。

新增中文文案后需要重跑：
    python tools/subset-fonts.py

依赖：pip install fonttools brotli
源字体（不入库，放本地任意目录后用 --src 指定，默认找 tools/src-fonts/）：
    https://github.com/notofonts/noto-cjk -> Serif/SubsetOTF/SC/
      NotoSerifSC-Regular.otf / NotoSerifSC-SemiBold.otf
"""
import argparse
import io
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, "fonts")

# CJK 统一表意文字 + 扩展A + 全角标点/符号 + 部分中文排版常用符号
CJK_RE = re.compile(
    "[　-〿㐀-䶿一-鿿豈-﫿＀-￯"
    "—‘’“”…·]"
)

SCAN_DIRS = [ROOT, os.path.join(ROOT, "css"), os.path.join(ROOT, "js"),
             os.path.join(ROOT, "offer-detail")]
SCAN_EXTS = {".html", ".css", ".js"}


def collect_chars():
    chars = set()
    for d in SCAN_DIRS:
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            path = os.path.join(d, name)
            if os.path.isfile(path) and os.path.splitext(name)[1] in SCAN_EXTS:
                with open(path, encoding="utf-8", errors="ignore") as f:
                    chars.update(CJK_RE.findall(f.read()))
    return chars


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "tools", "src-fonts"),
                    help="存放 NotoSerifSC-*.otf 源字体的目录")
    args = ap.parse_args()

    chars = collect_chars()
    print(f"收集到 {len(chars)} 个 CJK 字符")
    text = "".join(sorted(chars))

    os.makedirs(FONTS_DIR, exist_ok=True)
    jobs = [("NotoSerifSC-Regular.otf", "noto-serif-sc-400.woff2"),
            ("NotoSerifSC-SemiBold.otf", "noto-serif-sc-600.woff2")]

    from fontTools import subset
    for src_name, out_name in jobs:
        src = os.path.join(args.src, src_name)
        if not os.path.isfile(src):
            print(f"跳过：找不到源字体 {src}")
            continue
        out = os.path.join(FONTS_DIR, out_name)
        subset.main([
            src,
            f"--text={text}",
            "--flavor=woff2",
            f"--output-file={out}",
            "--layout-features=*",
            "--drop-tables+=FFTM",
            "--no-hinting",
            "--desubroutinize",
        ])
        print(f"{out_name}: {os.path.getsize(out) // 1024}KB")


if __name__ == "__main__":
    main()
