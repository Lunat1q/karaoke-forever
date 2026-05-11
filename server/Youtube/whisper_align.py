#!/usr/bin/env python3
"""Forced-align lyrics to audio using stable-ts + faster-whisper.

Usage: whisper_align.py <audio_path> <lyrics_path> <output_path> [model_size]

Takes the user's actual lyrics and aligns them word-by-word to the audio,
preserving the original line structure from the lyrics file.
Produces JSON in the same format as AutoLyrixAlign's aligned.txt:
  [ [ {"word": "...", "start": 1.23, "end": 1.85, "ignore": false}, ... ], ... ]
"""
import sys
import json
import os
import re

def main():
    if len(sys.argv) < 4:
        print("Usage: whisper_align.py <audio_path> <lyrics_path> <output_path> [model_size]", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    lyrics_path = sys.argv[2]
    output_path = sys.argv[3]
    model_size = sys.argv[4] if len(sys.argv) > 4 else "small"

    # Read lyrics text
    with open(lyrics_path, "r", encoding="utf-8") as f:
        lyrics_text = f.read().strip()

    if not lyrics_text:
        print("ERROR: lyrics file is empty", file=sys.stderr)
        sys.exit(1)

    # Parse original line structure before alignment
    original_lines = [line.strip() for line in lyrics_text.splitlines()]
    original_lines = [line for line in original_lines if line]  # remove empty lines

    import stable_whisper

    cache_dir = os.environ.get("WHISPER_CACHE_DIR", "/data/whisper-models")
    os.makedirs(cache_dir, exist_ok=True)

    print(f"Loading Whisper model '{model_size}' (faster-whisper backend)...")
    model = stable_whisper.load_faster_whisper(model_size, download_root=cache_dir)

    print(f"Forced-aligning lyrics to {audio_path}...")
    # Auto-detect language from lyrics text
    has_cyrillic = any('\u0400' <= c <= '\u04FF' for c in lyrics_text)
    lang = "ru" if has_cyrillic else "en"
    print(f"Using language: {lang}")
    result = model.align(audio_path, lyrics_text, language=lang)

    # Collect all aligned words in order
    all_words = []
    for segment in result.segments:
        for word in segment.words:
            w = word.word.strip()
            if not w:
                continue
            all_words.append({
                "word": w,
                "start": round(word.start, 2),
                "end": round(word.end, 2),
                "ignore": False,
            })

    # Re-group aligned words back into original lyric lines
    aligned = []
    word_idx = 0
    for line_text in original_lines:
        line_words = line_text.split()
        line_aligned = []
        for _ in line_words:
            if word_idx < len(all_words):
                line_aligned.append(all_words[word_idx])
                word_idx += 1
        if line_aligned:
            aligned.append(line_aligned)

    # Append any remaining words as a final line
    if word_idx < len(all_words):
        aligned.append(all_words[word_idx:])

    # Fix zero-duration words by interpolating from neighbors
    for line in aligned:
        for i, w in enumerate(line):
            if w["end"] - w["start"] < 0.01:
                # Estimate duration from context
                prev_end = line[i - 1]["end"] if i > 0 else w["start"]
                next_start = line[i + 1]["start"] if i + 1 < len(line) else w["start"] + 0.3
                gap = next_start - prev_end
                if gap > 0.05:
                    w["start"] = prev_end
                    w["end"] = prev_end + min(gap, 0.3)
                else:
                    w["end"] = w["start"] + 0.2

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(aligned, f, ensure_ascii=False)

    total_words = sum(len(line) for line in aligned)
    print(f"Done: {total_words} words in {len(aligned)} lines -> {output_path}")

if __name__ == "__main__":
    main()
