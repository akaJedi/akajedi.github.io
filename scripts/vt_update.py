#!/usr/bin/env python3
import os, requests, yaml

API_KEY = os.getenv("VT_API_KEY")
HEADERS = {"x-apikey": API_KEY}
INPUT_FILE = "data/resumes.yaml"
OUTPUT_FILE = "data/resumes.yaml"

def vt_lookup(file_hash):
    url = f"https://www.virustotal.com/api/v3/files/{file_hash}"
    r = requests.get(url, headers=HEADERS)
    if r.status_code == 200:
        return f"https://www.virustotal.com/gui/file/{file_hash}"
    return None

if not API_KEY:
    print("❌ Please set your VirusTotal API key with: export VT_API_KEY=xxxx")
    exit(1)

with open(INPUT_FILE, "r") as f:
    resumes = yaml.safe_load(f)

for entry in resumes:
    for file in entry["files"]:
        if file["format"] == "DOCX":
            file_hash = file["hash_full"]
            vt_url = vt_lookup(file_hash)
            if vt_url:
                file["vt"] = vt_url
            else:
                file["vt"] = "not scanned"

with open(OUTPUT_FILE, "w") as f:
    yaml.dump(resumes, f, sort_keys=False)

print(f"✅ {OUTPUT_FILE} updated with VirusTotal links for DOCX files.")
