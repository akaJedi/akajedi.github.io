#!/usr/bin/env python3
"""
Hugo Unused Code Scanner
Analyzes Hugo project for unused files, templates, and assets
"""

import os
import re
import json
import yaml
from pathlib import Path
from collections import defaultdict
import argparse

class HugoUnusedScanner:
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.used_files = set()
        self.all_files = set()
        self.templates = set()
        self.partials = set()
        self.shortcodes = set()
        self.assets = set()
        self.content_files = set()
        self.static_files = set()
        self.data_files = set()
        self.i18n_files = set()
        
        # File patterns
        self.template_extensions = {'.html', '.md'}
        self.asset_extensions = {'.css', '.scss', '.js', '.ts'}
        self.image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'}
        self.content_extensions = {'.md', '.html'}
        
    def scan_project(self):
        """Main scanning method"""
        print("🔍 Scanning Hugo project structure...")
        self._collect_all_files()
        self._analyze_templates()
        self._analyze_content()
        self._analyze_assets()
        self._analyze_data_files()
        self._analyze_i18n()
        self._analyze_static_files()
        return self._generate_report()
    
    def _collect_all_files(self):
        """Collect all project files"""
        ignore_dirs = {'node_modules', 'public', 'resources', '_vendor', '.git', 'isableFastRender'}
        
        for root, dirs, files in os.walk(self.project_root):
            # Remove ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            root_path = Path(root)
            for file in files:
                file_path = root_path / file
                relative_path = file_path.relative_to(self.project_root)
                self.all_files.add(str(relative_path))
                
                # Categorize files
                if 'layouts' in relative_path.parts:
                    if file.endswith('.html'):
                        self.templates.add(str(relative_path))
                    if 'partials' in relative_path.parts:
                        self.partials.add(str(relative_path))
                    if 'shortcodes' in relative_path.parts:
                        self.shortcodes.add(str(relative_path))
                
                elif 'assets' in relative_path.parts:
                    self.assets.add(str(relative_path))
                
                elif 'content' in relative_path.parts:
                    if any(file.endswith(ext) for ext in self.content_extensions):
                        self.content_files.add(str(relative_path))
                
                elif 'static' in relative_path.parts:
                    self.static_files.add(str(relative_path))
                
                elif 'data' in relative_path.parts:
                    self.data_files.add(str(relative_path))
                
                elif 'i18n' in relative_path.parts:
                    self.i18n_files.add(str(relative_path))
    
    def _analyze_templates(self):
        """Analyze template usage and dependencies"""
        print("📄 Analyzing templates...")
        
        for template_path in self.templates:
            full_path = self.project_root / template_path
            if full_path.exists():
                content = self._read_file(full_path)
                if content:
                    self.used_files.add(template_path)
                    self._find_template_references(content, template_path)
    
    def _find_template_references(self, content, current_file):
        """Find references to other templates, partials, and assets"""
        # Find partial references: {{ partial "name" }}
        partial_refs = re.findall(r'{{\s*partial\s+["\']([^"\']+)["\']', content)
        for ref in partial_refs:
            partial_path = f"layouts/partials/{ref}"
            if not ref.endswith('.html'):
                partial_path += '.html'
            self.used_files.add(partial_path)
        
        # Find template references: {{ template "name" }}
        template_refs = re.findall(r'{{\s*template\s+["\']([^"\']+)["\']', content)
        for ref in template_refs:
            self.used_files.add(f"layouts/{ref}")
        
        # Find shortcode usage: {{< shortcode >}}
        shortcode_refs = re.findall(r'{{\s*<?[<\s]*([a-zA-Z0-9_-]+)', content)
        for ref in shortcode_refs:
            if ref not in ['if', 'with', 'range', 'block', 'define', 'template', 'partial']:
                shortcode_path = f"layouts/shortcodes/{ref}.html"
                self.used_files.add(shortcode_path)
        
        # Find asset references
        asset_refs = re.findall(r'["\']([^"\']*\.(css|scss|js|ts|png|jpg|jpeg|gif|svg|webp|ico))["\']', content, re.IGNORECASE)
        for ref, ext in asset_refs:
            if not ref.startswith('http'):
                self.used_files.add(f"assets/{ref}")
                self.used_files.add(f"static/{ref}")
        
        # Find data file references: .Site.Data.filename
        data_refs = re.findall(r'\.Site\.Data\.([a-zA-Z0-9_-]+)', content)
        for ref in data_refs:
            for ext in ['.yaml', '.yml', '.json', '.toml']:
                data_path = f"data/{ref}{ext}"
                self.used_files.add(data_path)
    
    def _analyze_content(self):
        """Analyze content files"""
        print("📝 Analyzing content files...")
        
        for content_path in self.content_files:
            full_path = self.project_root / content_path
            if full_path.exists():
                content = self._read_file(full_path)
                if content:
                    self.used_files.add(content_path)
                    self._find_content_references(content)
    
    def _find_content_references(self, content):
        """Find asset references in content"""
        # Find image/asset references in markdown
        asset_refs = re.findall(r'!\[.*?\]\(([^)]+)\)|src=["\']([^"\']+)["\']|href=["\']([^"\']+)["\']', content)
        for ref_tuple in asset_refs:
            for ref in ref_tuple:
                if ref and not ref.startswith('http') and not ref.startswith('#'):
                    self.used_files.add(f"static/{ref.lstrip('/')}")
    
    def _analyze_assets(self):
        """Analyze asset dependencies"""
        print("🎨 Analyzing assets...")
        
        for asset_path in self.assets:
            full_path = self.project_root / asset_path
            if full_path.exists() and asset_path.endswith(('.css', '.scss')):
                content = self._read_file(full_path)
                if content:
                    # Find @import statements
                    imports = re.findall(r'@import\s+["\']([^"\']+)["\']', content)
                    for imp in imports:
                        import_path = f"assets/{imp}"
                        if not imp.endswith(('.css', '.scss')):
                            import_path += '.scss'
                        self.used_files.add(import_path)
                    
                    # Find url() references
                    urls = re.findall(r'url\(["\']?([^)"\'\s]+)["\']?\)', content)
                    for url in urls:
                        if not url.startswith('http') and not url.startswith('data:'):
                            self.used_files.add(f"static/{url.lstrip('/')}")
    
    def _analyze_data_files(self):
        """Analyze data file usage"""
        print("📊 Analyzing data files...")
        
        # Data files are referenced in templates, already handled in template analysis
        # Mark homepage.yml as used (common pattern)
        for data_file in ['homepage.yml', 'homepage.yaml', 'config.yml', 'config.yaml']:
            data_path = f"data/{data_file}"
            if data_path in self.all_files:
                self.used_files.add(data_path)
    
    def _analyze_i18n(self):
        """Analyze i18n files"""
        print("🌍 Analyzing i18n files...")
        
        # Check hugo.toml for language configuration
        config_path = self.project_root / "hugo.toml"
        if config_path.exists():
            content = self._read_file(config_path)
            if content:
                # Look for language codes
                lang_matches = re.findall(r'\[languages\.([a-z]{2})\]', content)
                for lang in lang_matches:
                    for ext in ['.yaml', '.yml']:
                        i18n_path = f"i18n/{lang}{ext}"
                        if i18n_path in self.all_files:
                            self.used_files.add(i18n_path)
    
    def _analyze_static_files(self):
        """Analyze static files that might be linked"""
        print("📁 Analyzing static files...")
        
        # Common files that are typically used
        common_static = {
            'static/robots.txt',
            'static/favicon.ico', 
            'static/CNAME',
            'static/keybase.txt',
            'static/security-policy.md'
        }
        
        for static_file in common_static:
            if static_file in self.all_files:
                self.used_files.add(static_file)
    
    def _read_file(self, file_path):
        """Safely read file content"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except (UnicodeDecodeError, IOError):
            # Try with different encoding or skip binary files
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    return f.read()
            except:
                return None
    
    def _generate_report(self):
        """Generate unused files report"""
        unused_files = []
        potentially_unused = []
        
        for file_path in self.all_files:
            if file_path not in self.used_files:
                # Skip certain files that are typically needed
                skip_patterns = [
                    r'\.git.*',
                    r'node_modules',
                    r'public/',
                    r'resources/',
                    r'package.*\.json',
                    r'.*\.toml$',
                    r'.*\.mod$',
                    r'.*\.sum$',
                    r'.*\.txt$' # tree files, etc.
                ]
                
                if any(re.match(pattern, file_path) for pattern in skip_patterns):
                    continue
                
                # Categorize by type
                if any(file_path.endswith(ext) for ext in self.image_extensions):
                    potentially_unused.append(('Image', file_path))
                elif file_path.endswith(('.css', '.scss', '.js')):
                    unused_files.append(('Asset', file_path))
                elif 'layouts' in file_path:
                    unused_files.append(('Template', file_path))
                elif 'content' in file_path:
                    unused_files.append(('Content', file_path))
                elif 'static' in file_path and file_path.endswith('.docx'):
                    potentially_unused.append(('Resume', file_path))
                else:
                    unused_files.append(('Other', file_path))
        
        return {
            'unused_files': unused_files,
            'potentially_unused': potentially_unused,
            'total_files': len(self.all_files),
            'used_files': len(self.used_files),
            'unused_count': len(unused_files) + len(potentially_unused)
        }

def main():
    parser = argparse.ArgumentParser(description='Scan Hugo project for unused files')
    parser.add_argument('path', nargs='?', default='.', help='Path to Hugo project (default: current directory)')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')
    args = parser.parse_args()
    
    scanner = HugoUnusedScanner(args.path)
    report = scanner.scan_project()
    
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("\n" + "="*60)
        print("🧹 HUGO UNUSED CODE SCANNER REPORT")
        print("="*60)
        print(f"📊 Total files scanned: {report['total_files']}")
        print(f"✅ Files in use: {report['used_files']}")
        print(f"❌ Potentially unused: {report['unused_count']}")
        print()
        
        if report['unused_files']:
            print("🗑️  DEFINITELY UNUSED FILES:")
            print("-" * 40)
            for file_type, file_path in sorted(report['unused_files']):
                print(f"  [{file_type:8}] {file_path}")
            print()
        
        if report['potentially_unused']:
            print("⚠️  POTENTIALLY UNUSED FILES:")
            print("-" * 40)
            for file_type, file_path in sorted(report['potentially_unused']):
                print(f"  [{file_type:8}] {file_path}")
            print()
        
        print("💡 Note: Review 'potentially unused' files manually.")
        print("   Some files (like resume docs) might be directly linked.")

if __name__ == "__main__":
    main()