const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
    { regex: /bg-\[var\(--color-surface\)\]/g, replacement: 'bg-card' },
    { regex: /bg-\[var\(--color-surface-raised\)\]/g, replacement: 'bg-muted' },
    { regex: /text-\[var\(--color-text-muted\)\]/g, replacement: 'text-muted-foreground' },
    { regex: /text-\[var\(--color-text-secondary\)\]/g, replacement: 'text-muted-foreground' },
    { regex: /text-\[var\(--color-text-primary\)\]/g, replacement: 'text-foreground' },
    { regex: /border-\[var\(--color-border\)\]/g, replacement: 'border-border' },
    { regex: /border-\[var\(--color-border-subtle\)\]/g, replacement: 'border-border/50' },
    { regex: /bg-\[var\(--color-accent-glow\)\]/g, replacement: 'bg-primary/10' },
    { regex: /text-\[var\(--color-accent\)\]/g, replacement: 'text-primary' },
    { regex: /border-\[var\(--color-accent\)\]/g, replacement: 'border-primary' },
    { regex: /text-\[var\(--color-danger\)\]/g, replacement: 'text-destructive' },
    { regex: /bg-\[var\(--color-danger\)\]/g, replacement: 'bg-destructive' },
    { regex: /text-\[var\(--color-success\)\]/g, replacement: 'text-emerald-500' },
    { regex: /text-\[var\(--color-warning\)\]/g, replacement: 'text-amber-500' }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            processDirectory(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let original = content;
            
            replacements.forEach(rule => {
                content = content.replace(rule.regex, rule.replacement);
            });
            
            if (content !== original) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        }
    });
}

console.log('Starting refactor...');
processDirectory(directoryPath);
console.log('Done.');
