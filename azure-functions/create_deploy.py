#!/usr/bin/env python3
import zipfile
import os

zippath = 'c:\\VXT\\azure-functions\\deploy.zip'
if os.path.exists(zippath):
    os.remove(zippath)

# Create ZIP with just the essential files
files_to_zip = ['function_app.py', 'host.json', 'requirements.txt']

with zipfile.ZipFile(zippath, 'w') as zf:
    for file in files_to_zip:
        fpath = os.path.join('c:\\VXT\\azure-functions', file)
        if os.path.exists(fpath):
            zf.write(fpath, arcname=file)
            print(f'Added: {file}')

size = os.path.getsize(zippath)
print(f'\nZIP created: {zippath}')
print(f'Size: {size:,} bytes')
