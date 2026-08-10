const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// 1. Add targetPrintEmployee state
content = content.replace(
    "const [targetEmployeeKey, setTargetEmployeeKey] = useState('');",
    "const [targetEmployeeKey, setTargetEmployeeKey] = useState('');\n    const [targetPrintEmployee, setTargetPrintEmployee] = useState('');"
);

// 2. Add filter to renderTargetsList
content = content.replace(
    /const totalTarget = targetsWithAchieved\.reduce/g,
    `let finalTargets = targetsWithAchieved;
        if (targetPrintEmployee) {
            finalTargets = finalTargets.filter(t => t.userId === targetPrintEmployee);
        }
        const totalTarget = finalTargets.reduce`
);
content = content.replace(
    /\{targetsWithAchieved\.map\(t => \{/g,
    `{finalTargets.map(t => {`
);

// 3. Add filter to renderPastMonthTargetsList
content = content.replace(
    /const dataList = getPastMonthTargetsData\(mKey\);/g,
    `let dataList = getPastMonthTargetsData(mKey);
        if (targetPrintEmployee) {
            dataList = dataList.filter(t => t.userId === targetPrintEmployee);
        }`
);

// 4. Add data-html2canvas-ignore to buttons
content = content.replace(
    /<button onClick=\{\(\) => handleEditCurrentTarget/g,
    '<button data-html2canvas-ignore="true" onClick={() => handleEditCurrentTarget'
);
content = content.replace(
    /<button onClick=\{\(\) => handleDeleteCurrentTarget/g,
    '<button data-html2canvas-ignore="true" onClick={() => handleDeleteCurrentTarget'
);

fs.writeFileSync('components/SalesLog.tsx', content);
