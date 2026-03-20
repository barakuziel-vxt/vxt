import zipfile
import os

# Create ZIP
with zipfile.ZipFile('deployment.zip', 'w') as zf:
    files = ['function_app.py', 'host.json', 'requirements.txt']
    for f in files:
        if os.path.exists(f):
            zf.write(f)
            print(f'✓ Added {f}')

size = os.path.getsize("deployment.zip")
print(f'ZIP created: {size} bytes')
