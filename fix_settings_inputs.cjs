const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');

content = content.replace(/value=\{localSettings\.appName\}/g, "value={localSettings.appName || ''}");
content = content.replace(/value=\{localSettings\.whatsappNumber\}/g, "value={localSettings.whatsappNumber || ''}");
content = content.replace(/value=\{localSettings\.tickerText\}/g, "value={localSettings.tickerText || ''}");

fs.writeFileSync('components/Settings.tsx', content);
