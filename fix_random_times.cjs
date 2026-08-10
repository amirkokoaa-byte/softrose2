const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /const generateRandomOut = \(\) => getRandomTime\(5, 45, 6, 10\); \/\/ 05:45 to 06:10 as requested/,
    `const generateRandomOut = (userName = "") => {
            const lowerName = userName.toLowerCase();
            if (lowerName.includes('coordinator')) {
                return getRandomTime(4, 45, 5, 15);
            } else if (lowerName.includes('usher')) {
                return getRandomTime(5, 45, 6, 15);
            }
            return getRandomTime(5, 45, 6, 15);
        };`
);

content = content.replace(
    /attOut = generateRandomOut\(\);/g,
    `attOut = generateRandomOut(u.name);`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
