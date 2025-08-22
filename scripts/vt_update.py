#!/usr/bin/env python3
import os
import yaml
import requests
import hashlib

# ==========================
# CONFIG
# ==========================
API_KEY = os.getenv("VT_API_KEY")  # export VT_API_KEY="your_key"
HEADERS = {"x-apikey": API_KEY} if API_KEY else {}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "..", "data", "resumes.yaml")

# Where DOCX files are stored
DOCX_DIR = os.path.join(BASE_DIR, "..", "static")

# ==========================
# HELPERS
# ==========================
def sha256sum(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def vt_lookup_or_upload(file_path, file_hash):
    """Check VirusTotal for hash. If missing, upload file."""
    if not API_KEY:
        return None

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
                analysis_id = data.get("data", {}).get("id")
                print(f"   ✅ Uploaded. Analysis ID: {analysis_id}")
                return f"https://www.virustotal.com/gui/file/{file_hash}"
            else:
                print(f"   ❌ Upload failed ({r.status_code}) {r.text}")
        except Exception as e:
            print(f"   ❌ Exception during upload: {e}")

    else:
        print(f"⚠️ VT lookup failed for {file_hash} (status {r.status_code})")

    return None


def discover_new_files(resumes):
    """Scan static/*.docx and add new entries if missing."""
    existing_files = {f["name"] for r in resumes for f in r.get("files", [])}

    for fname in os.listdir(DOCX_DIR):
        if fname.lower().endswith(".docx") and fname not in existing_files:
            path = os.path.join(DOCX_DIR, fname)
            if not os.path.isfile(path):
                continue

            size_kb = f"{os.path.getsize(path)//1024} KB"
            hash_full = sha256sum(path)

            # Title = everything between "DenisTolochko_" and date suffix
            parts = fname.split("_")
            role = "Unknown"
            if len(parts) >= 3:
                role = "_".join(parts[1:-1])  # drop first (name) and last (date+ext)

            resumes.append({
                "title": role,
                "files": [{
                    "name": fname,
                    "format": "DOCX",
                    "size": size_kb,
                    "hash": hash_full[:12],
                    "hash_full": hash_full
                }]
            })
            print(f"➕ Added new resume entry: {fname}")

    return resumes


def process_yaml():
    with open(INPUT_FILE, "r") as f:
        resumes = yaml.safe_load(f) or []

    # Step 1: auto-discover new files
    resumes = discover_new_files(resumes)

    # Step 2: update VT links for all DOCX
    for resume in resumes:
        for file in resume.get("files", []):
            if file.get("format") == "DOCX":
                file_path = os.path.join(DOCX_DIR, file["name"])
                if not os.path.exists(file_path):
                    continue
                vt_url = vt_lookup_or_upload(file_path, file["hash_full"])
                if vt_url:
                    file["vt"] = vt_url

    with open(INPUT_FILE, "w") as f:
        yaml.dump(resumes, f, sort_keys=False)

    print(f"✅ {INPUT_FILE} updated with resume entries + VirusTotal links.")


# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Input file not found: {INPUT_FILE}")
        exit(1)

    process_yaml()
