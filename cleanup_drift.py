with open('drift_detector.py', 'r') as f:
    content = f.read()

# Remove trailing backticks and extra newlines
while content.endswith('`\n') or content.endswith('`'):
    if content.endswith('`\n'):
        content = content[:-2]
    elif content.endswith('`'):
        content = content[:-1]

# Ensure single final newline
content = content.rstrip() + '\n'

with open('drift_detector.py', 'w') as f:
    f.write(content)

print('Cleaned up drift_detector.py')
