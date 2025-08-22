#!/usr/bin/env python3
import os
import yaml
import requests

# ==========================
# CONFIG
# ==========================
API_KEY = os.getenv("VT_API_KEY")  # set with: export VT_API_KEY="your_key"
HEADERS = {"x-apikey": API_KEY}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "..", "data", "resumes.yaml")

# Where DOCX files are stored (adjust if needed)
DOCX_DIR = os.path.join(BASE_DIR, "..", "static")

# ==========================
# FUNCTIONS
# ==========================

def vt_lookup_or_upload(file_path, file_hash):
    """Check VirusTotal for hash. If missing, upload file."""
    url = f"https://www.virustotal.com/api/v3/files/{file_hash}"
    r = requests.get(url, headers=HEADERS)

    if r.status_code == 200:
        return f"https://www.virustotal.com/gui/file/{file_hash}"

    elif r.status_code == 404:
        print(f"🔄 Hash {file_hash} not found, uploading {os.path.basename(file_path)}...")
        try:
            with open(file_path, "rb") as f:
                upload_url = "https://www.virustotal.com/api/v3/files"
                r = requests.post(upload_url, headers=HEADERS, files={"file": f})
            if r.status_code == 200:
                data = r.json()
                analysis_id = data["data"]["id"]
                print(f"   ✅ Uploaded. Analysis ID: {analysis_id}")
                return f"https://www.virustotal.com/gui/file/{file_hash}"
            else:
                print(f"   ❌ Upload failed ({r.status_code}) {r.text}")
        except Exception as e:
            print(f"   ❌ Exception during upload: {e}")

    else:
        print(f"⚠️ VT lookup failed for {file_hash} (status {r.status_code})")

    return None


def process_yaml():
    with open(INPUT_FILE, "r") as f:
        resumes = yaml.safe_load(f)

    for resume in resumes:
        for file in resume.get("files", []):
            if file.get("format") == "DOCX":
                file_path = os.path.join(DOCX_DIR, file["name"])
                vt_url = vt_lookup_or_upload(file_path, file["hash_full"])
                if vt_url:
                    file["vt"] = vt_url

    with open(INPUT_FILE, "w") as f:
        yaml.dump(resumes, f, sort_keys=False)

    print(f"✅ {INPUT_FILE} updated with VirusTotal links for DOCX files.")


# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    if not API_KEY:
        print("❌ Please set your VirusTotal API key first: export VT_API_KEY=your_key")
        exit(1)

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Input file not found: {INPUT_FILE}")
        exit(1)

    process_yaml()
