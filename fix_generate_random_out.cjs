const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const oldFunc = `        const generateRandomOut = (userName = "") => {
            const lowerName = userName.toLowerCase();
            if (lowerName.includes('coordinator')) {
                return getRandomTime(4, 45, 5, 15);
            } else if (lowerName.includes('usher')) {
                return getRandomTime(5, 45, 6, 15);
            }
            return getRandomTime(5, 45, 6, 15);
        };`;

const newFunc = `        const generateRandomOut = (userName = "") => {
            const lowerName = userName.toLowerCase();
            if (lowerName.includes('coordinator') || lowerName.includes('منسق')) {
                return getRandomTime(4, 45, 5, 15);
            } else if (lowerName.includes('usher') || lowerName.includes('أشر') || lowerName.includes('اشر')) {
                return getRandomTime(5, 45, 6, 15);
            }
            return getRandomTime(5, 45, 6, 15);
        };`;

if (content.includes(oldFunc)) {
    content = content.replace(oldFunc, newFunc);
    fs.writeFileSync('components/LeaveBalance.tsx', content);
    console.log('Fixed generateRandomOut');
} else {
    console.log('Could not find generateRandomOut to replace');
}
